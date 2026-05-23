#!/usr/bin/env node

/**
 * DIAGNOSTIC TOOL - Analyze and Fix Stuck Position
 * Run this to understand what's blocking your bot
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

async function diagnoseBot() {
  console.log('🔍 KUCOIN BOT DIAGNOSTIC TOOL');
  console.log('=' .repeat(60));
  
  try {
    // 1. Test API Connection
    console.log('\n📡 Testing API connection...');
    const serverTime = await makeRequest('GET', '/api/v1/timestamp');
    console.log(`✅ API Connected successfully`);
    console.log(`   Server time: ${new Date(serverTime).toISOString()}`);
    
    // 2. Check Account Balances
    console.log('\n💰 Checking account balances...');
    const accounts = await makeRequest('GET', '/api/v1/accounts');
    
    const usdtAccount = accounts.find(a => a.currency === 'USDT' && a.type === 'trade');
    const btcAccount = accounts.find(a => a.currency === 'BTC' && a.type === 'trade');
    const ethAccount = accounts.find(a => a.currency === 'ETH' && a.type === 'trade');
    const solAccount = accounts.find(a => a.currency === 'SOL' && a.type === 'trade');
    const kcsAccount = accounts.find(a => a.currency === 'KCS' && a.type === 'trade');
    
    const usdtAvailable = parseFloat(usdtAccount?.available || 0);
    const btcAvailable = parseFloat(btcAccount?.available || 0);
    const ethAvailable = parseFloat(ethAccount?.available || 0);
    const solAvailable = parseFloat(solAccount?.available || 0);
    const kcsAvailable = parseFloat(kcsAccount?.available || 0);
    
    console.log(`   USDT: ${usdtAvailable.toFixed(4)}`);
    console.log(`   BTC: ${btcAvailable.toFixed(8)}`);
    console.log(`   ETH: ${ethAvailable.toFixed(6)}`);
    console.log(`   SOL: ${solAvailable.toFixed(4)}`);
    console.log(`   KCS: ${kcsAvailable.toFixed(6)}`);
    
    // 3. Get Current Prices
    console.log('\n📊 Getting current prices...');
    const btcTicker = await makeRequest('GET', '/api/v1/market/orderbook/level1?symbol=BTC-USDT');
    const ethTicker = await makeRequest('GET', '/api/v1/market/orderbook/level1?symbol=ETH-USDT');
    const solTicker = await makeRequest('GET', '/api/v1/market/orderbook/level1?symbol=SOL-USDT');
    
    const btcPrice = parseFloat(btcTicker.price);
    const ethPrice = parseFloat(ethTicker.price);
    const solPrice = parseFloat(solTicker.price);
    
    console.log(`   BTC: $${btcPrice.toFixed(2)}`);
    console.log(`   ETH: $${ethPrice.toFixed(2)}`);
    console.log(`   SOL: $${solPrice.toFixed(4)}`);
    
    // 4. Calculate Portfolio Value
    const btcValue = btcAvailable * btcPrice;
    const ethValue = ethAvailable * ethPrice;
    const solValue = solAvailable * solPrice;
    const kcsValue = kcsAvailable * 1.5; // Approximate KCS value
    
    const totalValue = usdtAvailable + btcValue + ethValue + solValue + kcsValue;
    
    console.log('\n💼 Portfolio Value:');
    console.log(`   USDT:  $${usdtAvailable.toFixed(2)}`);
    console.log(`   BTC:   $${btcValue.toFixed(2)} (${(btcValue/totalValue*100).toFixed(1)}%)`);
    console.log(`   ETH:   $${ethValue.toFixed(2)} (${(ethValue/totalValue*100).toFixed(1)}%)`);
    console.log(`   SOL:   $${solValue.toFixed(2)} (${(solValue/totalValue*100).toFixed(1)}%)`);
    console.log(`   KCS:   $${kcsValue.toFixed(2)} (${(kcsValue/totalValue*100).toFixed(1)}%)`);
    console.log(`   TOTAL: $${totalValue.toFixed(2)}`);
    
    // 5. Check Open Orders
    console.log('\n📋 Checking open orders...');
    const orders = await makeRequest('GET', '/api/v1/orders?status=active');
    console.log(`   Total active orders: ${orders.totalNum || 0}`);
    
    if (orders.items && orders.items.length > 0) {
      console.log('\n   Open Orders:');
      orders.items.forEach((order, i) => {
        console.log(`   ${i+1}. ${order.symbol} ${order.side} ${order.size} @ ${order.price}`);
        console.log(`      ID: ${order.id}, Created: ${new Date(order.createdAt).toLocaleString()}`);
      });
    }
    
    // 6. Check Stuck Position
    console.log('\n🚨 Analyzing stuck position...');
    const btcPositionValue = btcAvailable * btcPrice;
    const symbolInfo = await makeRequest('GET', '/api/v1/symbols/BTC-USDT');
    
    const minFunds = parseFloat(symbolInfo.quoteMinFunds);
    const sizeIncrement = parseFloat(symbolInfo.baseIncrement);
    const minSizeRequired = Math.ceil(minFunds / btcPrice / sizeIncrement) * sizeIncrement;
    const minValueRequired = minSizeRequired * btcPrice;
    
    console.log(`   Current BTC position: ${btcAvailable.toFixed(8)} BTC`);
    console.log(`   Current position value: $${btcPositionValue.toFixed(2)}`);
    console.log(`   Minimum required: $${minFunds.toFixed(2)}`);
    console.log(`   Minimum size: ${minSizeRequired.toFixed(8)} BTC`);
    console.log(`   Minimum value: ${minValueRequired.toFixed(2)}`);
    
    if (btcPositionValue < minFunds) {
      console.log(`\n   ❌ POSITION STUCK!`);
      console.log(`   The position is $${(minFunds - btcPositionValue).toFixed(2)} below minimum`);
      console.log(`   Cannot close via API - manual intervention required`);
      
      const shortfall = minFunds - btcPositionValue;
      const btcNeeded = shortfall / btcPrice;
      
      console.log(`\n   💡 Solutions:`);
      console.log(`   1. Manual closure (RECOMMENDED):`);
      console.log(`      - Log into KuCoin.com`);
      console.log(`      - Go to Spot Trade → BTC-USDT`);
      console.log(`      - Sell ${btcAvailable.toFixed(8)} BTC at market price`);
      console.log(`      - This will unlock $${btcPositionValue.toFixed(2)} USDT`);
      console.log(`   2. Add more BTC:`);
      console.log(`      - Add ${btcNeeded.toFixed(8)} more BTC`);
      console.log(`      - This would bring total to ${minSizeRequired.toFixed(8)} BTC`);
      console.log(`      - Then bot could close position automatically`);
    } else {
      console.log(`\n   ✅ Position can be closed via API`);
      const closeableSize = Math.floor(btcAvailable / sizeIncrement) * sizeIncrement;
      const closeableValue = closeableSize * btcPrice;
      console.log(`   Can close: ${closeableSize.toFixed(8)} BTC ($${closeableValue.toFixed(2)})`);
    }
    
    // 7. Check Trading Requirements
    console.log('\n📏 Trading Requirements:');
    
    const tradingPairs = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT'];
    for (const pair of tradingPairs) {
      const info = await makeRequest('GET', `/api/v1/symbols/${pair}`);
      const ticker = await makeRequest('GET', `/api/v1/market/orderbook/level1?symbol=${pair}`);
      
      const pairMinFunds = parseFloat(info.quoteMinFunds);
      const pairSizeIncrement = parseFloat(info.baseIncrement);
      const currentPrice = parseFloat(ticker.price);
      const pairMinSize = Math.ceil(pairMinFunds / currentPrice / pairSizeIncrement) * pairSizeIncrement;
      const pairMinValue = pairMinSize * currentPrice;
      
      console.log(`   ${pair}:`);
      console.log(`      Min order: $${pairMinFunds.toFixed(2)}`);
      console.log(`      Min size: ${pairMinSize} base asset`);
      console.log(`      Min value: $${pairMinValue.toFixed(2)}`);
      console.log(`      Current price: $${currentPrice.toFixed(2)}`);
    }
    
    // 8. Configuration Check
    console.log('\n⚙️  Configuration Check:');
    console.log(`   MIN_POSITION_SIZE: ${process.env.MIN_POSITION_SIZE || 'NOT SET'}`);
    console.log(`   MAX_POSITION_SIZE: ${process.env.MAX_POSITION_SIZE || 'NOT SET'}`);
    console.log(`   RISK_PER_TRADE: ${process.env.RISK_PER_TRADE || 'NOT SET'}`);
    
    const minPosSize = parseFloat(process.env.MIN_POSITION_SIZE) || 0;
    if (minPosSize < 10) {
      console.log(`   ⚠️  MIN_POSITION_SIZE is below KuCoin minimum ($10)`);
      console.log(`   This was causing the stuck position issue!`);
    } else {
      console.log(`   ✅ Configuration meets KuCoin requirements`);
    }
    
    // 9. Recommendations
    console.log('\n🎯 RECOMMENDATIONS:');
    
    if (btcPositionValue < minFunds) {
      console.log('   1. IMMEDIATE: Manually close BTC position (see details above)');
      console.log('   2. This will unlock trading functionality');
      console.log('   3. Bot can then resume normal operations');
    }
    
    if (usdtAvailable >= minFunds) {
      console.log(`   4. After position closed, bot can trade normally`);
      console.log(`   5. You have $${usdtAvailable.toFixed(2)} USDT available for trading`);
    } else {
      console.log(`   4. Need to add more funds to meet minimum requirements`);
      console.log(`   5. Minimum needed: $${(minFunds - usdtAvailable).toFixed(2)} more USDT`);
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ DIAGNOSTIC COMPLETE');
    console.log('=' .repeat(60));
    
    if (btcPositionValue < minFunds) {
      console.log('\n🚨 ACTION REQUIRED: Manual position closure needed');
      console.log('See details above for specific instructions');
      process.exit(1);
    } else {
      console.log('\n✅ Bot can operate normally');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check API credentials in .env file');
    console.error('2. Verify API permissions include "Spot Trading"');
    console.error('3. Ensure IP whitelist includes your current IP');
    console.error('4. Check internet connection to api.kucoin.com');
    process.exit(1);
  }
}

diagnoseBot();