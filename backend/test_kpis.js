import http from 'http';

const login = (email, password) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password });
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode === 200 && parsed.token) resolve(parsed.token);
          else reject(new Error(`Login failed: ${res.statusCode} - ${body}`));
        } catch (e) {
          reject(new Error(`Parse error: ${body}`));
        }
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
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.on('error', reject);
    req.end();
  });
};

(async () => {
  try {
    const adminToken = await login('agadge797@gmail.com', 'Pass@1234567');
    const adminRes = await fetchApi('/api/admin/reports/summary?kpiOnly=true', adminToken);
    console.log('ADMIN DASHBOARD DATA:\n', JSON.stringify(adminRes, null, 2));

    const sellerToken = await login('kolhesnehal35@gmail.com', 'Pass@1234567');
    const sellerRes = await fetchApi('/api/dashboard/summary', sellerToken);
    console.log('SELLER DASHBOARD DATA:\n', JSON.stringify(sellerRes, null, 2));
  } catch (err) {
    console.error('ERROR:', err.message);
  }
})();
