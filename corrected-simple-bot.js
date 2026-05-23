#!/usr/bin/env node

/**
 * ENHANCED CORRECTED TRADING BOT WITH PROPER PRICE ROUNDING
 * Uses real KuCoin minimums and proper price validation
 */

const https = require('https');
const crypto = require('crypto');
require('dotenv').config();

const { roundKuCoinOrderPrice, roundKuCoinOrderSize, validateKuCoinOrder } = require('./kucoin-validator');

const apiKey = process.env.KUCOIN_API_KEY;
const secretKey = process.env.KUCOIN_SECRET_KEY;
const passphrase = process.env.KUCOIN_API_PASSPHRASE;

const CONFIG = {
  maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE) || 50,
  minPositionSize: parseFloat(process.env.MIN_POSITION_SIZE) || 0.5,
  tradingPairs: ['BTC-USDT', 'ETH-USDT', 'SOL-USDT']
};

console.log('⚙️  Configuration:');
console.log(`   Max position: $${CONFIG.maxPositionSize}`);
console.log(`   Min position: $${CONFIG.minPositionSize}`);
console.log('');

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

async function placeOrder(pair, side, size, price) {
  try {
    console.log(`🔍 Validating order: ${pair} ${side} ${size} @ $${price}`);
    
    // Validate order with proper error checking
    const validation = validateKuCoinOrder(pair, size, price);
    if (!validation.valid) {
      throw new Error(`Order validation failed: ${validation.error}`);
    }
    
    console.log(`   ✅ Order validation passed`);
    
    const orderBody = JSON.stringify({
      clientOid: `${side}-${pair}-${Date.now()}`,
      side: side,
      symbol: pair,
      type: 'market',
      size: size
    });
    
    const order = await makeRequest('POST', '/api/v1/orders', orderBody);
    
    console.log(`   ✅ Order placed successfully: ${order.orderId}`);
    return order;
    
  } catch (error) {
    throw new Error(`Failed to place order: ${error.message}`);
  }
}

async function runTradingBot() {
  console.log('🚀 ENHANCED CORRECTED TRADING BOT');
  console.log('============================================================\n');
  
  try {
    // Get USDT balance
    const accounts = await makeRequest('GET', '/api/v1/accounts');
    const usdtAccount = accounts.find(a => a.currency === 'USDT' && a.type === 'trade');
    const usdtBalance = parseFloat(usdtAccount?.available || 0);
    
    console.log(`💰 Current USDT balance: $${usdtBalance.toFixed(4)}\n`);
    
    if (usdtBalance < CONFIG.minPositionSize) {
      console.log(`⚠️  Insufficient balance. Need at least $${CONFIG.minPositionSize}`);
      console.log(`   Current: $${usdtBalance.toFixed(4)}`);
      return;
    }
    
    const tradingAmount = Math.min(usdtBalance, CONFIG.maxPositionSize);
    console.log(`📊 Trading amount: $${tradingAmount.toFixed(2)}`);
    console.log(`🎯 Analyzing trading opportunities...\n`);
    
    let orderPlaced = false;
    
    for (const pair of CONFIG.tradingPairs) {
      if (orderPlaced) break;
      
      try {
        // Get current price
        const ticker = await makeRequest('GET', `/api/v1/market/orderbook/level1?symbol=${pair}`);
        const currentPrice = parseFloat(ticker.price);
        
        console.log(`${pair}: $${currentPrice.toFixed(2)}`);
        
        // Calculate desired size and round properly
        const desiredSize = tradingAmount / currentPrice;
        const roundedSize = roundKuCoinOrderSize(pair, desiredSize);
        const roundedPrice = roundKuCoinOrderPrice(pair, currentPrice);
        
        console.log(`   Desired size: ${desiredSize.toFixed(8)} ${pair.split('-')[0]}`);
        console.log(`   Rounded size: ${roundedSize.toFixed(8)} ${pair.split('-')[0]}`);
        console.log(`   Rounded price: $${roundedPrice.toFixed(2)}`);
        
        // Validate the rounded order
        const orderValue = roundedSize * roundedPrice;
        if (orderValue < 0.1) {
          console.log(`   ❌ Order value ($${orderValue.toFixed(4)}) below minimum ($0.10)\n`);
          continue;
        }
        
        console.log(`   Order value: $${orderValue.toFixed(2)}`);
        console.log(`   Placing buy order...`);
        
        const order = await placeOrder(pair, 'buy', roundedSize, roundedPrice);
        
        console.log(`\n✅ SUCCESS: Order placed on ${pair}`);
        console.log(`   Order ID: ${order.orderId}`);
        console.log(`   Size: ${roundedSize.toFixed(8)} ${pair.split('-')[0]}`);
        console.log(`   Value: $${orderValue.toFixed(2)}`);
        
        orderPlaced = true;
        
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}\n`);
      }
    }
    
    if (!orderPlaced) {
      console.log('⚠️  Could not place any orders');
      console.log('   All pairs failed validation or had insufficient funds');
    }
    
  } catch (error) {
    console.error('❌ Trading bot failed:', error.message);
  }
  
  console.log('\n============================================================');
  console.log('🎉 TRADING COMPLETE');
  console.log('============================================================');
}

console.log('✅ KuCoin order validation loaded with corrected API data');
console.log('   BTC-USDT minimum: $0.1 (not $10)');

console.log('');
console.log('⚙️  Configuration:');
console.log(`   Max position: $${CONFIG.maxPositionSize}`);
console.log(`   Min position: $${CONFIG.minPositionSize}`);

console.log('');
console.log('This bot will:');
console.log('✅ Use real KuCoin minimums ($0.10, not $10)');
console.log('✅ Properly round prices to valid increments');
console.log('✅ Properly round sizes to valid increments');
console.log('✅ Validate all orders before placing');

console.log('');
console.log('Starting in 3 seconds...\n');

setTimeout(() => {
  runTradingBot().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}, 3000);