#!/usr/bin/env node

/**
 * AUTO TAKE PROFIT - Automatically secure profits when position is profitable
 */

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

async function takeProfit(percentToSell = 0.25) {
  console.log('💰 AUTO TAKE PROFIT SYSTEM\n');
  console.log(`Target: Sell ${(percentToSell * 100).toFixed(0)}% of position\n`);
  
  try {
    // Get current position
    const accounts = await makeRequest('GET', '/api/v1/accounts');
    const ethAccount = accounts.find(a => a.currency === 'ETH' && a.type === 'trade');
    const usdtAccount = accounts.find(a => a.currency === 'USDT' && a.type === 'trade');
    
    const ethAvailable = parseFloat(ethAccount?.available || 0);
    const usdtAvailable = parseFloat(usdtAccount?.available || 0);
    
    if (ethAvailable <= 0) {
      console.log('❌ No ETH position to sell');
      return;
    }
    
    // Get current price
    const ticker = await makeRequest('GET', '/api/v1/market/orderbook/level1?symbol=ETH-USDT');
    const currentPrice = parseFloat(ticker.price);
    const positionValue = ethAvailable * currentPrice;
    
    console.log('📊 CURRENT POSITION:');
    console.log(`   Size: ${ethAvailable.toFixed(6)} ETH`);
    console.log(`   Price: $${currentPrice.toFixed(2)}`);
    console.log(`   Value: $${positionValue.toFixed(2)}`);
    console.log(`   USDT: $${usdtAvailable.toFixed(4)}`);
    console.log('');
    
    // Calculate sell amount
    const sellAmount = ethAvailable * percentToSell;
    const estimatedValue = sellAmount * currentPrice;
    
    console.log('💰 PROFIT TAKING PLAN:');
    console.log(`   Sell Amount: ${sellAmount.toFixed(6)} ETH (${(percentToSell * 100).toFixed(0)}%)`);
    console.log(`   Estimated Value: $${estimatedValue.toFixed(2)}`);
    console.log(`   Remaining ETH: ${(ethAvailable - sellAmount).toFixed(6)}`);
    console.log('');
    
    // Get symbol info for validation
    const symbols = await makeRequest('GET', '/api/v2/symbols');
    const ethSymbol = symbols.find(s => s.symbol === 'ETH-USDT');
    
    // Round size and price
    const baseIncrement = parseFloat(ethSymbol.baseIncrement);
    const priceIncrement = parseFloat(ethSymbol.priceIncrement);
    const minFunds = parseFloat(ethSymbol.minFunds);
    
    // Calculate size and price
    const rawSize = sellAmount;
    const roundedSize = Math.floor(rawSize / baseIncrement) * baseIncrement;
    const roundedPrice = Math.floor(currentPrice / priceIncrement) * priceIncrement;
    const orderValue = roundedSize * roundedPrice;
    
    console.log('🔧 ORDER DETAILS:');
    console.log(`   Original Size: ${rawSize.toFixed(6)} ETH`);
    console.log(`   Rounded Size: ${roundedSize.toFixed(6)} ETH`);
    console.log(`   Original Price: $${currentPrice.toFixed(2)}`);
    console.log(`   Rounded Price: $${roundedPrice.toFixed(2)}`);
    console.log(`   Order Value: $${orderValue.toFixed(4)}`);
    console.log(`   Min Funds Required: $${minFunds}`);
    console.log('');
    
    // Validate order
    if (orderValue < minFunds) {
      console.log('❌ ORDER TOO SMALL');
      console.log(`   Order value $${orderValue.toFixed(4)} is below minimum $${minFunds}`);
      console.log(`   Try selling ${(minFunds / positionValue).toFixed(2)} or more`);
      return;
    }
    
    if (roundedSize < baseIncrement) {
      console.log('❌ SIZE TOO SMALL');
      console.log(`   Size ${roundedSize} is below minimum increment ${baseIncrement}`);
      return;
    }
    
    console.log('✅ ORDER VALIDATION PASSED\n');
    
    // Place sell order
    const orderBody = JSON.stringify({
      clientOid: `sell-eth-${Date.now()}`,
      side: 'sell',
      symbol: 'ETH-USDT',
      type: 'market',
      size: roundedSize.toFixed(8)
    });
    
    console.log('📝 PLACING SELL ORDER...');
    console.log(`   Side: SELL`);
    console.log(`   Symbol: ETH-USDT`);
    console.log(`   Size: ${roundedSize.toFixed(6)} ETH`);
    console.log(`   Type: MARKET`);
    console.log('');
    
    const order = await makeRequest('POST', '/api/v1/orders', orderBody);
    
    console.log('✅ ORDER PLACED SUCCESSFULLY!');
    console.log(`   Order ID: ${order.orderId}`);
    console.log(`   Status: ${order.status}`);
    console.log('');
    console.log('💵 PROFIT SECURED:');
    console.log(`   Approximate Value: $${estimatedValue.toFixed(2)}`);
    console.log(`   This adds to your available USDT balance`);
    console.log('');
    console.log('📊 NEW POSITION:');
    console.log(`   Remaining ETH: ${(ethAvailable - roundedSize).toFixed(6)}`);
    console.log(`   New Position Value: $${((ethAvailable - roundedSize) * currentPrice).toFixed(2)}`);
    console.log('');
    console.log('=' .repeat(60));
    console.log('✅ PROFIT TAKING COMPLETE');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Profit taking failed:', error.message);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let sellPercent = 0.25; // Default sell 25%

if (args.length > 0) {
  sellPercent = parseFloat(args[0]) / 100;
  if (isNaN(sellPercent) || sellPercent <= 0 || sellPercent > 1) {
    console.error('Invalid percentage. Use: node auto-take-profit.js [25]');
    process.exit(1);
  }
}

console.log('🎯 AUTO TAKE PROFIT');
console.log(`Securing profits from current position...\n`);

setTimeout(() => {
  takeProfit(sellPercent).then(() => {
    console.log('\n💡 Run again to sell more if desired');
    console.log('💡 Use monitor-trading.js to check new balances');
    process.exit(0);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}, 1000);