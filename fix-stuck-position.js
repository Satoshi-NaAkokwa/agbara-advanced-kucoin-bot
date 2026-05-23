// Quick fix script for KuCoin bot order size issue
const https = require('https');
const crypto = require('crypto');
require('dotenv').config();

const apiKey = process.env.KUCOIN_API_KEY;
const secretKey = process.env.KUCOIN_SECRET_KEY;
const passphrase = process.env.KUCOIN_API_PASSPHRASE;

function sign(str) {
  return crypto.createHmac('sha256', secretKey).update(str).digest('base64');
}

async function makeRequest(method, endpoint, body = '') {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now().toString();
    const what = timestamp + method + endpoint + body;
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
    
    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }
    
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
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function fixStuckPosition() {
  console.log('🔧 Fixing stuck BTC position...\n');
  
  try {
    // 1. Get account info
    const accounts = await makeRequest('GET', '/api/v1/accounts');
    const usdtAccount = accounts.find(a => a.currency === 'USDT' && a.type === 'trade');
    const btcAccount = accounts.find(a => a.currency === 'BTC' && a.type === 'trade');
    
    console.log('💰 Current Balances:');
    console.log(`   USDT: ${parseFloat(usdtAccount.available).toFixed(4)}`);
    console.log(`   BTC: ${parseFloat(btcAccount.available).toFixed(8)}\n`);
    
    // 2. Get current BTC price
    const ticker = await makeRequest('GET', '/api/v1/market/orderbook/level1?symbol=BTC-USDT');
    const currentPrice = parseFloat(ticker.price);
    
    console.log(`📊 Current BTC Price: $${currentPrice.toFixed(2)}\n`);
    
    // 3. Get open orders
    const orders = await makeRequest('GET', '/api/v1/orders?status=active&symbol=BTC-USDT');
    console.log(`📋 Open Orders: ${orders.items.length}`);
    
    if (orders.items.length > 0) {
      console.log('   Cancelling all open orders...');
      for (const order of orders.items) {
        try {
          await makeRequest('DELETE', `/api/v1/orders/${order.id}`);
          console.log(`   ✅ Cancelled order ${order.id}`);
        } catch (error) {
          console.log(`   ❌ Failed to cancel order ${order.id}: ${error.message}`);
        }
      }
    }
    
    // 4. Get minimum order requirements
    const symbolInfo = await makeRequest('GET', '/api/v1/symbols/BTC-USDT');
    console.log('\n📏 BTC-USDT Requirements:');
    console.log(`   Min Funds: ${symbolInfo.quoteMinFunds} USDT`);
    console.log(`   Size Increment: ${symbolInfo.baseIncrement} BTC`);
    console.log(`   Price Increment: ${symbolInfo.quoteIncrement} USDT\n`);
    
    // 5. Calculate required minimum order size
    const minFunds = parseFloat(symbolInfo.quoteMinFunds);
    const minSize = minFunds / currentPrice;
    const sizeIncrement = parseFloat(symbolInfo.baseIncrement);
    
    // Round up to next valid increment
    const minValidSize = Math.ceil(minSize / sizeIncrement) * sizeIncrement;
    const minValidValue = minValidSize * currentPrice;
    
    console.log('💡 Minimum Valid Order:');
    console.log(`   Size: ${minValidSize.toFixed(8)} BTC`);
    console.log(`   Value: $${minValidValue.toFixed(2)} USDT\n`);
    
    // 6. Check current position size
    const currentBTC = parseFloat(btcAccount.available);
    const currentValue = currentBTC * currentPrice;
    
    console.log('📈 Current Position:');
    console.log(`   Size: ${currentBTC.toFixed(8)} BTC`);
    console.log(`   Value: $${currentValue.toFixed(2)} USDT`);
    
    if (currentValue < minFunds) {
      console.log('\n❌ PROBLEM: Position value below minimum!');
      console.log(`   Current: $${currentValue.toFixed(2)}`);
      console.log(`   Required: $${minFunds}`);
      console.log(`   Missing: $${(minFunds - currentValue).toFixed(2)}\n`);
      
      console.log('🚨 SOLUTION OPTIONS:');
      console.log('1. Manual intervention required - log into KuCoin website');
      console.log('2. Add more BTC to reach minimum order size');
      console.log('3. Wait for BTC price to increase (value goes up)\n');
    } else {
      console.log('\n✅ Position can be closed via API');
      
      // Calculate sell order size (round to valid increment)
      const sellSize = Math.floor(currentBTC / sizeIncrement) * sizeIncrement;
      const sellValue = sellSize * currentPrice;
      
      console.log('📝 Recommended Sell Order:');
      console.log(`   Size: ${sellSize.toFixed(8)} BTC`);
      console.log(`   Price: $${currentPrice.toFixed(2)}`);
      console.log(`   Value: $${sellValue.toFixed(2)}\n`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixStuckPosition();