const https = require('https');
const crypto = require('crypto');
require('dotenv').config({ path: '/home/openclaw/.openclaw/workspace/agbara-advanced-kucoin-bot/.env' });

const apiKey = process.env.KUCOIN_API_KEY;
const secretKey = process.env.KUCOIN_SECRET_KEY;
const passphrase = process.env.KUCOIN_API_PASSPHRASE;

function sign(str) {
  return crypto.createHmac('sha256', secretKey).update(str).digest('base64');
}

function testConnection() {
  const endpoint = '/api/v1/accounts';
  const method = 'GET';
  const timestamp = Date.now().toString();
  const what = timestamp + method + endpoint;
  const signature = sign(what);
  const passphraseSigned = sign(passphrase);

  const options = {
    hostname: 'api.kucoin.com',
    port: 443,
    path: endpoint,
    method: method,
    headers: {
      'KC-API-KEY': apiKey,
      'KC-API-SIGN': signature,
      'KC-API-TIMESTAMP': timestamp,
      'KC-API-PASSPHRASE': passphraseSigned,
      'KC-API-KEY-VERSION': '2',
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.code === '200000') {
            resolve(result.data);
          } else {
            reject(new Error(`API Error: ${result.msg} (Code: ${result.code})`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

testConnection()
  .then(accounts => {
    console.log('✅ Connection successful!');
    console.log('Accounts found:', accounts.length);
    const usdt = accounts.find(a => a.currency === 'USDT' && a.type === 'trade');
    if (usdt) {
      console.log('USDT Balance:', usdt.available);
    }
  })
  .catch(error => {
    console.error('❌ Connection failed:', error.message);
  });