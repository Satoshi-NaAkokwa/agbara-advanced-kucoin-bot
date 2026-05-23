#!/usr/bin/env node

/**
 * ATTEMPT TO CLOSE THE STUCK BTC POSITION WITH CORRECT VALIDATION
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

async function closeStuckPosition() {
  console.log('🔧 Attempting to close stuck BTC position with proper validation...\n');
  
  try {
    // 1. Get account info
    const accounts = await makeRequest('GET', '/api/v1/accounts');
    const btcAccount = accounts.find(a => a.currency === 'BTC' && a.type === 'trade');
    const btcAvailable = parseFloat(btcAccount.available);
    
    console.log(`💰 Current BTC balance: ${btcAvailable.toFixed(8)} BTC`);
    
    // 2. Get current BTC price
    const ticker = await makeRequest('GET', '/api/v1/market/orderbook/level1?symbol=BTC-USDT');
    const currentPrice = parseFloat(ticker.price);
    
    console.log(`📊 Current BTC price: $${currentPrice.toFixed(2)}`);
    console.log(`💵 Position value: $${(btcAvailable * currentPrice).toFixed(2)}\n`);
    
    // 3. Get KuCoin requirements from API
    const symbolInfo = await makeRequest('GET', '/api/v1/symbols/BTC-USDT');
    
    const minFunds = parseFloat(symbolInfo.minFunds);
    const sizeIncrement = parseFloat(symbolInfo.baseIncrement);
    const priceIncrement = parseFloat(symbolInfo.priceIncrement);
    
    console.log('📏 KuCoin Requirements (from API):');
    console.log(`   Min Funds: $${minFunds}`);
    console.log(`   Size Increment: ${sizeIncrement}`);
    console.log(`   Price Increment: ${priceIncrement}\n`);
    
    // 4. Check if position meets requirements
    const positionValue = btcAvailable * currentPrice;
    
    console.log('📋 Position Analysis:');
    console.log(`   Position value: $${positionValue.toFixed(2)}`);
    console.log(`   Minimum required: $${minFunds}`);
    
    if (positionValue < minFunds) {
      console.log(`\n❌ POSITION STILL TOO SMALL`);
      console.log(`   Value is $${(minFunds - positionValue).toFixed(2)} below minimum`);
      console.log(`   Size is ${btcAvailable.toFixed(8)} BTC`);
      
      // Calculate how much more BTC needed
      const btcNeeded = (minFunds - positionValue) / currentPrice;
      console.log(`   Need additional ${btcNeeded.toFixed(8)} BTC to reach minimum`);
      console.log(`   Or wait for BTC price to increase to ${(minFunds / btcAvailable).toFixed(2)}\n`);
      
      console.log('🚨 MANUAL INTERVENTION STILL REQUIRED');
      console.log('   The position cannot be closed via API');
      console.log('   Please follow the manual closure instructions in URGENT_FIX_REQUIRED.md');
      return;
    }
    
    console.log(`\n✅ Position value meets minimum requirement!`);
    
    // 5. Calculate valid order size
    // Round down to nearest valid increment
    let sellSize = Math.floor(btcAvailable / sizeIncrement) * sizeIncrement;
    const sellValue = sellSize * currentPrice;
    
    // Round price to valid increment
    let sellPrice = Math.floor(currentPrice / priceIncrement) * priceIncrement;
    
    console.log('📝 Validated Sell Order:');
    console.log(`   Original size: ${btcAvailable.toFixed(8)} BTC`);
    console.log(`   Valid size: ${sellSize.toFixed(8)} BTC`);
    console.log(`   Original price: $${currentPrice.toFixed(2)}`);
    console.log(`   Valid price: $${sellPrice.toFixed(2)}`);
    console.log(`   Order value: $${sellValue.toFixed(2)}\n`);
    
    // 6. Try to place market sell order
    console.log('🔄 Attempting market sell order...');
    
    try {
      const marketOrder = {
        symbol: 'BTC-USDT',
        side: 'sell',
        type: 'market',
        size: sellSize.toString(),
        clientOid: `manual-close-${Date.now()}`
      };
      
      const orderResult = await makeRequest('POST', '/api/v1/orders', JSON.stringify(marketOrder));
      
      console.log('✅ ORDER PLACED SUCCESSFULLY!');
      console.log(`   Order ID: ${orderResult.orderId}`);
      console.log(`   Status: ${orderResult.status}`);
      console.log(`   Size: ${orderResult.size} BTC`);
      console.log(`   Value: $${(parseFloat(orderResult.size) * currentPrice).toFixed(2)}\n`);
      
      console.log('🎉 POSITION CLOSED SUCCESSFULLY!');
      console.log('Your KuCoin bot should now be able to trade normally.');
      console.log('The configuration fixes have been applied and will prevent this in the future.');
      
    } catch (error) {
      console.log(`❌ Order placement failed: ${error.message}`);
      
      // Try limit order instead
      console.log('\n🔄 Attempting limit sell order instead...');
      
      try {
        const limitOrder = {
          symbol: 'BTC-USDT',
          side: 'sell',
          type: 'limit',
          size: sellSize.toString(),
          price: sellPrice.toString(),
          clientOid: `manual-close-limit-${Date.now()}`
        };
        
        const limitResult = await makeRequest('POST', '/api/v1/orders', JSON.stringify(limitOrder));
        
        console.log('✅ LIMIT ORDER PLACED SUCCESSFULLY!');
        console.log(`   Order ID: ${limitResult.orderId}`);
        console.log(`   Status: ${limitResult.status}`);
        console.log(`   Size: ${limitResult.size} BTC @ $${limitResult.price}\n`);
        
        console.log('🎉 POSITION CLOSING IN PROGRESS!');
        console.log('The limit order should fill quickly at current market prices.');
        console.log('Your bot will be able to trade normally once the position is closed.');
        
      } catch (limitError) {
        console.log(`❌ Limit order also failed: ${limitError.message}`);
        console.log('\n🚨 MANUAL INTERVENTION REQUIRED');
        console.log('   Both market and limit orders failed');
        console.log('   Please manually close the position through KuCoin website');
        console.log('   See URGENT_FIX_REQUIRED.md for detailed instructions');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error during position closure attempt:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check API credentials are correct');
    console.log('2. Verify API permissions include "Spot Trading"');
    console.log('3. Check if there are network issues');
    console.log('4. Try manual closure as fallback');
  }
}

closeStuckPosition();