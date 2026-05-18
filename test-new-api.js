const https = require('https');
const crypto = require('crypto');

const apiKey = "6a0b29798ac94900019ca148";
const secretKey = "aa30f585-acd9-4174-a102-d1e1ed0eae7b";
const passphrase = "Y@uareG0d";

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
    accounts.forEach(acc => {
      if (parseFloat(acc.balance) > 0) {
        console.log(`${acc.currency}: ${acc.balance} (${acc.type})`);
      }
    });
  })
  .catch(error => {
    console.error('❌ Connection failed:', error.message);
  });