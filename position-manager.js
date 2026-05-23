#!/usr/bin/env node

/**
 * POSITION MANAGER - Monitor and manage current ETH position
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

async function managePosition() {
  console.log('🎯 POSITION MANAGER - ETH-USDT\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. Get current ETH position
    const accounts = await makeRequest('GET', '/api/v1/accounts');
    const ethAccount = accounts.find(a => a.currency === 'ETH' && a.type === 'trade');
    const usdtAccount = accounts.find(a => a.currency === 'USDT' && a.type === 'trade');
    
    const ethAvailable = parseFloat(ethAccount?.available || 0);
    const usdtAvailable = parseFloat(usdtAccount?.available || 0);
    
    // 2. Get current ETH price
    const ticker = await makeRequest('GET', '/api/v1/market/orderbook/level1?symbol=ETH-USDT');
    const currentPrice = parseFloat(ticker.price);
    const positionValue = ethAvailable * currentPrice;
    
    console.log('📊 CURRENT POSITION:');
    console.log(`   Size: ${ethAvailable.toFixed(6)} ETH`);
    console.log(`   Current Price: $${currentPrice.toFixed(2)}`);
    console.log(`   Position Value: $${positionValue.toFixed(2)}`);
    console.log(`   USDT Available: $${usdtAvailable.toFixed(4)}`);
    console.log('');
    
    // 3. Calculate entry point and PnL (assuming ~$2132 entry from earlier)
    const entryPrice = 2132.04; // From earlier trade
    const pnl = (currentPrice - entryPrice) * ethAvailable;
    const pnlPercent = ((currentPrice - entryPrice) / entryPrice * 100).toFixed(2);
    
    console.log('💵 PROFIT/LOSS:');
    console.log(`   Entry Price: $${entryPrice.toFixed(2)}`);
    console.log(`   Current Price: $${currentPrice.toFixed(2)}`);
    console.log(`   P/L: $${pnl.toFixed(2)} (${pnlPercent > 0 ? '+' : ''}${pnlPercent}%)`);
    console.log('');
    
    // 4. Trading recommendations
    console.log('🎯 TRADING RECOMMENDATIONS:');
    console.log('');
    
    if (pnlPercent > 2) {
      console.log('✅ STRONG BUY SIGNAL - Consider taking profit');
      console.log('   Price has moved significantly in your favor');
      console.log('   You could sell for a guaranteed profit');
    } else if (pnlPercent > 0.5) {
      console.log('⚠️  MODERATE GAIN - Consider partial profit taking');
      console.log('   Price is up but could go higher');
      console.log('   Consider selling 50% and letting rest run');
    } else if (pnlPercent < -1) {
      console.log('❌ LOSS POSITION - Consider stop-loss');
      console.log('   Price has moved against you');
      console.log('   Consider cutting losses to preserve capital');
    } else {
      console.log('⏳ HOLDING - Position is near breakeven');
      console.log('   Wait for clearer direction');
      console.log('   Monitor for breakout or breakdown');
    }
    
    console.log('');
    
    // 5. Get 24h price change for context
    const stats = await makeRequest('GET', '/api/v1/market/stats?symbol=ETH-USDT');
    const change24h = parseFloat(stats.changeRate) * 100;
    const vol24h = parseFloat(stats.vol) * currentPrice;
    
    console.log('📈 24H MARKET CONTEXT:');
    console.log(`   ETH-USDT 24h Change: ${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}%`);
    console.log(`   24h Volume: $${vol24h.toFixed(2)} M`);
    console.log('');
    
    // 6. Position suggestions
    console.log('💡 POSITION MANAGEMENT SUGGESTIONS:');
    console.log('');
    
    if (usdtAvailable < 0.01) {
      console.log('⚠️  LOW USDT BALANCE');
      console.log('   • Cannot open new positions');
      console.log('   • Focus on managing current ETH position');
      console.log('   • Consider exiting to free up capital');
    }
    
    if (pnlPercent > 1) {
      console.log('✅ PROFIT OPPORTUNITY');
      console.log('   • Take partial profits if desired');
      console.log('   • Set stop-loss at breakeven');
      console.log('   • Let remaining position run');
    }
    
    if (Math.abs(change24h) > 3) {
      console.log('⚠️  HIGH VOLATILITY');
      console.log('   • Consider tighter stops');
      console.log('   • Monitor for reversals');
      console.log('   • Be prepared for rapid moves');
    }
    
    console.log('');
    console.log('🎯 ACTION ITEMS:');
    console.log(`   1. Monitor ETH price for ${pnlPercent > 0 ? 'profit' : 'recovery'} opportunity`);
    console.log(`   2. Set ${pnlPercent > 0 ? 'take-profit' : 'stop-loss'} at ${pnlPercent > 0 ? (entryPrice * 1.02).toFixed(2) : (entryPrice * 0.98).toFixed(2)}`);
    console.log('   3. Check balance again if considering new positions');
    console.log('   4. Use monitor-trading.js for regular updates');
    
    console.log('');
    console.log('=' .repeat(60));
    console.log('✅ Position analysis complete');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Position management failed:', error.message);
  }
}

console.log('🎯 ETH-USDT POSITION ANALYSIS');
console.log('Analyzing current position and providing recommendations...\n');

setTimeout(() => {
  managePosition().then(() => {
    console.log('\n💡 Run this periodically to monitor your position');
    process.exit(0);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}, 1000);