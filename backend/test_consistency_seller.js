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
    const sellerToken = await login('kolhesnehal35@gmail.com', 'Pass@1234567');
    console.log('--- SELLER CONSISTENCY AUDIT ---');
    
    // 1. Dashboard counts
    const dashboard = await fetchApi('/api/dashboard/summary', sellerToken);
    const dashData = dashboard.data?.counts || dashboard.counts || dashboard.data || dashboard;
    console.log('Dashboard Counts:');
    console.log('  Opportunities:', dashData.sellerOpportunitiesCount);
    console.log('  Open Tenders:', dashData.sellerOpenTendersCount);
    console.log('  Bids/Quotations:', dashData.sellerSubmittedBidsCount, '/', dashData.sellerQuotationsCount);
    console.log('  Active POs:', dashData.sellerActivePOsCount);
    console.log('  Catalogue:', dashData.sellerCatalogueItemsCount);
    console.log('  Pending Invoices:', dashData.sellerPendingInvoicesCount);
    console.log('');

    // 2. Listing counts
    const oppList = await fetchApi('/api/procurement-bids', sellerToken);
    console.log('Opportunities List Total:', extractTotal(oppList), '| Match?', extractTotal(oppList) === dashData.sellerOpportunitiesCount ? 'YES' : 'NO');
    
    // For Open Tenders list, the seller UI hits /procurement-bids but with filter=open-tenders or similar.
    // Dashboard sellerOpenTenders uses tender.count + procurementBid.count with TENDER methods.
    
    const bidsList = await fetchApi('/api/seller/procurement-bids', sellerToken);
    const marketplaceList = await fetchApi('/api/seller/requirement-responses', sellerToken);
    const totalQuotations = extractTotal(bidsList) + extractTotal(marketplaceList);
    console.log('Bids/Quotations List Total:', totalQuotations, '| Match?', totalQuotations === dashData.sellerQuotationsCount ? 'YES' : 'NO');

    const posList = await fetchApi('/api/procurement-orders', sellerToken);
    console.log('POs List Total:', extractTotal(posList), '| Match?', extractTotal(posList) === dashData.sellerActivePOsCount ? 'YES' : 'NO');

    const catList = await fetchApi('/api/catalogue?sellerId=me&limit=1', sellerToken);
    console.log('Catalogue List Total:', extractTotal(catList), '| Match?', extractTotal(catList) === dashData.sellerCatalogueItemsCount ? 'YES' : 'NO');

    const invList = await fetchApi('/api/payments/invoices?status=PENDING&limit=1', sellerToken);
    console.log('Pending Invoices List Total:', extractTotal(invList), '| Match?', extractTotal(invList) === dashData.sellerPendingInvoicesCount ? 'YES' : 'NO');

  } catch (err) {
    console.error('ERROR:', err.message);
  }
})();
