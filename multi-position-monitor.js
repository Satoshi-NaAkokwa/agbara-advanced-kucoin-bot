#!/usr/bin/env node

/**
 * MULTI-POSITION MONITOR
 * Monitor all open positions simultaneously
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

async function monitorAllPositions() {
  console.log('🔍 MULTI-POSITION MONITORING...\n');
  console.log('=' .repeat(60));
  
  try {
    // Get all account balances
    const accounts = await makeRequest('GET', '/api/v1/accounts');
    const ethAccount = accounts.find(a => a.currency === 'ETH' && a.type === 'trade');
    const btcAccount = accounts.find(a => a.currency === 'BTC' && a.type === 'trade');
    const usdtAccount = accounts.find(a => a.currency === 'USDT' && a.type === 'trade');
    
    const ethAvailable = parseFloat(ethAccount?.available || 0);
    const btcAvailable = parseFloat(btcAccount?.available || 0);
    const usdtAvailable = parseFloat(usdtAccount?.available || 0);
    
    // Get current prices
    const ethTicker = await makeRequest('GET', '/api/v1/market/orderbook/level1?symbol=ETH-USDT');
    const btcTicker = await makeRequest('GET', '/api/v1/market/orderbook/level1?symbol=BTC-USDT');
    
    const ethPrice = parseFloat(ethTicker.price);
    const btcPrice = parseFloat(btcTicker.price);
    
    // Calculate position values
    const ethValue = ethAvailable * ethPrice;
    const btcValue = btcAvailable * btcPrice;
    const totalPortfolio = ethValue + btcValue + usdtAvailable;
    
    console.log('💰 PORTFOLIO OVERVIEW:');
    console.log(`   USDT: $${usdtAvailable.toFixed(4)}`);
    console.log(`   ETH: ${ethAvailable.toFixed(6)} ($${ethValue.toFixed(2)})`);
    console.log(`   BTC: ${btcAvailable.toFixed(8)} ($${btcValue.toFixed(2)})`);
    console.log(`   Total Portfolio: $${totalPortfolio.toFixed(2)}`);
    console.log('');
    
    // ETH Position Analysis
    const ethEntry = 2132.04; // From earlier trade
    const ethPnl = (ethPrice - ethEntry) * ethAvailable;
    const ethPnlPercent = ((ethPrice - ethEntry) / ethEntry * 100);
    
    console.log('📊 ETH-USDT POSITION:');
    console.log(`   Size: ${ethAvailable.toFixed(6)} ETH`);
    console.log(`   Entry: $${ethEntry.toFixed(2)}`);
    console.log(`   Current: $${ethPrice.toFixed(2)}`);
    console.log(`   Value: $${ethValue.toFixed(2)}`);
    console.log(`   P/L: $${ethPnl.toFixed(2)} (${ethPnlPercent > 0 ? '+' : ''}${ethPnlPercent.toFixed(2)}%)`);
    console.log('');
    
    // BTC Position Analysis
    const btcEntry = 77548.00; // From recent trade
    const btcPnl = (btcPrice - btcEntry) * btcAvailable;
    const btcPnlPercent = ((btcPrice - btcEntry) / btcEntry * 100);
    
    console.log('📊 BTC-USDT POSITION:');
    console.log(`   Size: ${btcAvailable.toFixed(8)} BTC`);
    console.log(`   Entry: $${btcEntry.toFixed(2)}`);
    console.log(`   Current: $${btcPrice.toFixed(2)}`);
    console.log(`   Value: $${btcValue.toFixed(2)}`);
    console.log(`   P/L: $${btcPnl.toFixed(2)} (${btcPnlPercent > 0 ? '+' : ''}${btcPnlPercent.toFixed(2)}%)`);
    console.log('');
    
    // Combined P/L
    const totalPnl = ethPnl + btcPnl;
    const totalPnlPercent = (totalPnl / totalPortfolio * 100);
    
    console.log('💵 COMBINED PERFORMANCE:');
    console.log(`   Total P/L: $${totalPnl.toFixed(2)} (${totalPnlPercent > 0 ? '+' : ''}${totalPnlPercent.toFixed(2)}%)`);
    console.log(`   Win Rate: ${(totalPnl > 0 ? 'Profitable' : 'Breakeven')}`);
    console.log('');
    
    // Market Context
    const ethStats = await makeRequest('GET', '/api/v1/market/stats?symbol=ETH-USDT');
    const btcStats = await makeRequest('GET', '/api/v1/market/stats?symbol=BTC-USDT');
    
    console.log('📈 MARKET CONTEXT:');
    console.log(`   ETH-USDT 24h: ${(parseFloat(ethStats.changeRate) * 100).toFixed(2)}%`);
    console.log(`   BTC-USDT 24h: ${(parseFloat(btcStats.changeRate) * 100).toFixed(2)}%`);
    console.log('');
    
    // Trading Recommendations
    console.log('🎯 TRADING RECOMMENDATIONS:');
    
    if (totalPnl > 0.5) {
      console.log('   ✅ PORTFOLIO PROFITABLE - Consider partial profit taking');
    } else if (totalPnl < -0.5) {
      console.log('   ⚠️  PORTFOLIO AT LOSS - Consider risk management');
    } else {
      console.log('   ⏳ PORTFOLIO NEAR BREAKEVEN - Continue monitoring');
    }
    
    if (ethPnlPercent > 1) {
      console.log('   ✅ ETH position strong - Consider taking profits');
    } else if (ethPnlPercent < -1) {
      console.log('   ⚠️  ETH position weak - Monitor closely');
    }
    
    if (btcPnlPercent > 1) {
      console.log('   ✅ BTC position strong - Consider taking profits');
    } else if (btcPnlPercent < -1) {
      console.log('   ⚠️  BTC position weak - Monitor closely');
    }
    
    if (usdtAvailable < 0.1) {
      console.log('   💡 Low USDT balance - Wait for positions to close');
    } else {
      console.log('   💡 USDT available - Could open additional positions');
    }
    
    console.log('');
    console.log('💡 AVAILABLE ACTIONS:');
    if (ethPnlPercent > 0.5) {
      console.log('   node auto-take-profit.js 50  # Take 50% ETH profits');
    }
    if (btcPnlPercent > 0.5) {
      console.log('   node auto-take-profit.js 50  # Take 50% BTC profits');
    }
    console.log('   node monitor-trading.js         # Detailed monitoring');
    console.log('   node position-manager.js        # Position analysis');
    
    console.log('');
    console.log('=' .repeat(60));
    console.log('✅ MULTI-POSITION MONITORING COMPLETE');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Multi-position monitoring failed:', error.message);
  }
}

console.log('🔍 MULTI-POSITION MONITOR');
console.log('Monitoring all open positions simultaneously...\n');

setTimeout(() => {
  monitorAllPositions().then(() => {
    console.log('\n💡 Run this periodically to track all positions');
    process.exit(0);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}, 1000);