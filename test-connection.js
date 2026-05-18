const https = require('https');
const crypto = require('crypto');
require('dotenv').config();

class TestKuCoinConnection {
  constructor() {
    this.apiKey = process.env.KUCOIN_API_KEY;
    this.secretKey = process.env.KUCOIN_SECRET_KEY;
    this.passphrase = process.env.KUCOIN_API_PASSPHRASE;
    this.baseUrl = 'api.kucoin.com';
    this.apiVersion = '/api/v1';
  }

  sign(str) {
    return crypto.createHmac('sha256', this.secretKey).update(str).digest('base64');
  }

  getTimestamp() {
    return Date.now().toString();
  }

  makeRequest(method, endpoint, body = '') {
    return new Promise((resolve, reject) => {
      const timestamp = this.getTimestamp();
      const what = timestamp + method + endpoint + body;
      const signature = this.sign(what);
      const passphrase = this.sign(this.passphrase);

      const options = {
        hostname: this.baseUrl,
        port: 443,
        path: this.apiVersion + endpoint,
        method: method,
        headers: {
          'KC-API-KEY': this.apiKey,
          'KC-API-SIGN': signature,
          'KC-API-TIMESTAMP': timestamp,
          'KC-API-PASSPHRASE': passphrase,
          'KC-API-KEY-VERSION': '2',
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.code === '200000') {
              resolve(result.data);
            } else {
              reject(new Error(`KuCoin API Error: ${result.msg} (Code: ${result.code})`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (body) {
        req.write(body);
      }

      req.end();
    });
  }

  async testConnection() {
    console.log('Testing KuCoin API connection...');
    console.log('API Key:', this.apiKey ? this.apiKey.substring(0, 8) + '...' : 'not set');
    console.log('Secret Key:', this.secretKey ? this.secretKey.substring(0, 8) + '...' : 'not set');
    console.log('Passphrase:', this.passphrase ? this.passphrase.substring(0, 4) + '...' : 'not set');
    
    try {
      // Test getting accounts
      const accounts = await this.makeRequest('GET', '/accounts');
      console.log('✅ Accounts fetched successfully');
      console.log('   Account count:', accounts.length);
      
      // Test getting ticker
      const ticker = await this.makeRequest('GET', '/market/orderbook/level1?symbol=BTC-USDT');
      console.log('✅ Ticker fetched successfully');
      console.log('   BTC Price:', ticker.price);
      
      console.log('\n✅ KuCoin API connection test PASSED');
      return true;
    } catch (error) {
      console.error('❌ KuCoin API connection test FAILED');
      console.error('   Error:', error.message);
      return false;
    }
  }
}

const tester = new TestKuCoinConnection();
tester.testConnection()

testKuCoinConnection()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });