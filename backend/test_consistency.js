import http from 'http';

const login = (email, password) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password });
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode === 200 && parsed.token) resolve(parsed.token);
          else reject(new Error(`Login failed: ${body}`));
        } catch (e) { reject(new Error(`Parse error: ${body}`)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

const fetchApi = (path, token) => {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
      });
    });
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error(`Request timed out: ${path}`));
    });
    req.on('error', reject);
    req.end();
  });
};

const extractTotal = (res) => {
  if (!res) return null;
  if (res.pagination?.totalItems !== undefined) return res.pagination.totalItems;
  if (res.meta?.total !== undefined) return res.meta.total;
  if (res.total !== undefined) return res.total;
  if (Array.isArray(res.data)) return res.data.length;
  if (Array.isArray(res)) return res.length;
  return null;
};

(async () => {
  try {
    const adminToken = await login('agadge797@gmail.com', 'Pass@1234567');
    console.log('--- ADMIN CONSISTENCY AUDIT ---');
    
    // 1. Dashboard counts
    const dashboard = await fetchApi('/api/admin/reports/summary?kpiOnly=true', adminToken);
    console.log('Dashboard response:', dashboard);
    const dashData = dashboard.data || dashboard;
    console.log('Dashboard Counts:');
    console.log('  Active Sellers:', dashData.activeSellers);
    console.log('  Active Buyers:', dashData.activeBuyers);
    console.log('  Pending Approval:', dashData.pendingApproval);
    console.log('  Total Network:', dashData.totalNetwork);
    console.log('  Purchase Orders:', dashData.purchaseOrders);
    console.log('  Payments:', dashData.payments);
    console.log('');

    // 2. Listing counts
    const onboarding = await fetchApi('/api/admin/onboarding', adminToken);
    const sellers = (onboarding.data?.sellers || onboarding.sellers || []);
    const buyers = (onboarding.data?.buyers || onboarding.buyers || []);
    
    // Calculate pending approval
    const pendingStatuses = ['pending', 'pending_validation', 'manual_review_required', 'under_compliance_review', 'resubmission_required'];
    const pendingSellers = sellers.filter(s => pendingStatuses.includes(s.onboardingStatus));
    const pendingBuyers = buyers.filter(b => pendingStatuses.includes(b.onboardingStatus));
    const totalPending = pendingSellers.length + pendingBuyers.length;

    // Active
    const activeStatuses = ['approved', 'approved_for_procurement'];
    const activeSellers = sellers.filter(s => activeStatuses.includes(s.onboardingStatus));
    const activeBuyers = buyers.filter(b => activeStatuses.includes(b.onboardingStatus));

    console.log('Sellers List Active Total:', activeSellers.length, '| Match?', activeSellers.length === dashData.activeSellers ? 'YES' : 'NO');
    console.log('Buyers List Active Total:', activeBuyers.length, '| Match?', activeBuyers.length === dashData.activeBuyers ? 'YES' : 'NO');
    console.log('Pending List Total:', totalPending, '| Match?', totalPending === dashData.pendingApproval ? 'YES' : 'NO');

    const networkList = await fetchApi('/api/admin/users', adminToken);
    const usersTotal = Array.isArray(networkList?.data) ? networkList.data.length : Array.isArray(networkList) ? networkList.length : extractTotal(networkList);
    console.log('Users List Total:', usersTotal, '| Match?', usersTotal === dashData.totalNetwork ? 'YES' : 'NO');
    
    const posList = await fetchApi('/api/procurement-orders', adminToken);
    const posTotal = Array.isArray(posList?.data) ? posList.data.length : extractTotal(posList);
    console.log('POs List Total:', posTotal, '| Match?', posTotal === dashData.purchaseOrders ? 'YES' : 'NO');

    const paymentsList = await fetchApi('/api/payments', adminToken);
    const paymentsTotal = Array.isArray(paymentsList?.data) ? paymentsList.data.length : extractTotal(paymentsList);
    console.log('Payments List Total:', paymentsTotal, '| Match?', paymentsTotal === dashData.payments ? 'YES' : 'NO');

  } catch (err) {
    console.error('ERROR:', err.message);
  }
})();
