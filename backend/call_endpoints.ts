import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

const JWT_SECRET = "MSME_PugArch_JWT_SECRET_SUPER_SECURE_KEY_2026";

async function main() {
  const payload = {
    id: 6,
    email: "kolhesnehal065@gmail.com",
    role: "buyer"
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  console.log('Signed token:', token);

  const resDirect = await fetch('http://localhost:5000/api/direct-purchases', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Direct Purchases API status:', resDirect.status);
  const dataDirect = await resDirect.json();
  console.log('Direct Purchases API response:', JSON.stringify(dataDirect, null, 2));

  const resQuotes = await fetch('http://localhost:5000/api/quote-requests', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Quote Requests API status:', resQuotes.status);
  const dataQuotes = await resQuotes.json();
  console.log('Quote Requests API response:', JSON.stringify(dataQuotes, null, 2));
}

main().catch(console.error);
