const https = require('https');
const crypto = require('crypto');

// Test with provided credentials
const apiKey = '6a00d2a90ca919000199aad7';
const secretKey = '49977e09-dc49-4cb9-986c-e9e94c82d503';
const passphrase = 'Y0u@reall';

function sign(str) {
  return crypto.createHmac('sha256', secretKey).update(str).digest('base64');
}

function getTimestamp() {
  return Date.now().toString();
}

async function testConnection() {
  console.log('Testing KuCoin API with direct connection...');
  console.log('API Key:', apiKey.substring(0, 8) + '...');
  
  const endpoint = '/api/v1/accounts';
  const method = 'GET';
  const timestamp = getTimestamp();
  const what = timestamp + method + endpoint;
  const signature = sign(what);
  const passphraseSigned = sign(passphrase);
  
  console.log('Timestamp:', timestamp);
  console.log('Passphrase (signed):', passphraseSigned.substring(0, 10) + '...');

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
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('Response:', JSON.stringify(result, null, 2));
          if (result.code === '200000') {
            resolve(result.data);
          } else {
            reject(new Error(`API Error: ${result.msg} (Code: ${result.code})`));
          }
        } catch (error) {
          reject(new Error(`Parse Error: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

testConnection()
  .then(data => {
    console.log('✅ Connection successful!');
    console.log('Accounts:', data.length);
  })
  .catch(error => {
    console.error('❌ Connection failed:', error.message);
  });