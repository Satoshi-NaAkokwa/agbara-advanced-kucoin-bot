#!/usr/bin/env node

/**
 * ONE-CLICK PROFIT ACTION
 * Execute recommended trading action immediately
 */

const { execSync } = require('child_process');
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

async function executeOneClickAction() {
  console.log('🎯 ONE-CLICK TRADING ACTION\n');
  console.log('Executing recommended trading action...\n');
  console.log('=' .repeat(60));
  
  try {
    // Get current position
    const accounts = await makeRequest('GET', '/api/v1/accounts');
    const ethAccount = accounts.find(a => a.currency === 'ETH' && a.type === 'trade');
    const usdtAccount = accounts.find(a => a.currency === 'USDT' && a.type === 'trade');
    
    const ethAvailable = parseFloat(ethAccount?.available || 0);
    const usdtAvailable = parseFloat(usdtAccount?.available || 0);
    
    if (ethAvailable <= 0) {
      console.log('❌ No ETH position to manage');
      console.log('Run corrected-simple-bot.js to open a new position');
      return;
    }
    
    // Get current price
    const ticker = await makeRequest('GET', '/api/v1/market/orderbook/level1?symbol=ETH-USDT');
    const currentPrice = parseFloat(ticker.price);
    
    // Calculate position
    const entryPrice = 2132.04; // From earlier trade
    const positionValue = ethAvailable * currentPrice;
    const pnl = (currentPrice - entryPrice) * ethAvailable;
    const pnlPercent = ((currentPrice - entryPrice) / entryPrice * 100);
    
    // Get market context
    const stats = await makeRequest('GET', '/api/v1/market/stats?symbol=ETH-USDT');
    const change24h = parseFloat(stats.changeRate) * 100;
    const high24h = parseFloat(stats.high);
    
    // Calculate distance to 24h high
    const distanceToHigh = ((high24h - currentPrice) / currentPrice * 100);
    const nearHigh = distanceToHigh < 2; // Within 2% of high
    
    console.log('📊 CURRENT SITUATION:');
    console.log(`   ETH Position: ${ethAvailable.toFixed(6)} ETH`);
    console.log(`   Entry Price: $${entryPrice.toFixed(2)}`);
    console.log(`   Current Price: $${currentPrice.toFixed(2)}`);
    console.log(`   Position Value: $${positionValue.toFixed(2)}`);
    console.log(`   P/L: $${pnl.toFixed(2)} (${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`);
    console.log(`   24h Change: ${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}%`);
    console.log(`   Distance to 24h High: ${distanceToHigh.toFixed(2)}%`);
    console.log('');
    
    // Determine action
    let action, sellPercent, reasoning;
    
    if (pnlPercent > 1 && nearHigh) {
      action = 'TAKE_PARTIAL_PROFIT';
      sellPercent = 50;
      reasoning = 'Strong profit + near 24h high = lock in gains';
    } else if (pnlPercent > 2) {
      action = 'TAKE_PROFIT';
      sellPercent = 100;
      reasoning = 'Strong profit signal = secure all gains';
    } else if (pnlPercent > 0.5 && nearHigh) {
      action = 'REDUCE_POSITION';
      sellPercent = 25;
      reasoning = 'Moderate profit + near high = reduce risk';
    } else if (pnlPercent < -1) {
      action = 'CUT_LOSS';
      sellPercent = 100;
      reasoning = 'Significant loss = preserve capital';
    } else {
      action = 'HOLD';
      sellPercent = 0;
      reasoning = 'Position in normal range = continue monitoring';
    }
    
    console.log('🎯 RECOMMENDED ACTION:');
    console.log(`   Action: ${action}`);
    console.log(`   Sell Percentage: ${sellPercent}%`);
    console.log(`   Reasoning: ${reasoning}`);
    console.log('');
    
    if (action === 'HOLD') {
      console.log('💡 RECOMMENDATION:');
      console.log('   Continue holding and monitoring');
      console.log('   Position is in a normal range');
      console.log('   Auto-monitor will alert on significant changes');
      console.log('');
      console.log('💡 Run this again in 30 minutes to check status');
      return;
    }
    
    // Execute action
    console.log('🚀 EXECUTING ACTION:');
    console.log(`   Selling ${sellPercent}% of position`);
    console.log(`   Estimated value: $${(positionValue * (sellPercent / 100)).toFixed(2)}`);
    console.log('');
    
    try {
      const result = execSync(`node auto-take-profit.js ${sellPercent}`, { 
        cwd: process.cwd(),
        encoding: 'utf8'
      });
      console.log(result);
    } catch (error) {
      console.error('❌ Action execution failed:', error.message);
    }
    
    console.log('');
    console.log('=' .repeat(60));
    console.log('✅ ONE-CLICK ACTION COMPLETE');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ One-click action failed:', error.message);
  }
}

console.log('🎯 ONE-CLICK TRADING ACTION');
console.log('Executing AI-recommended trading action...\n');

setTimeout(() => {
  executeOneClickAction().then(() => {
    console.log('\n💡 Run this periodically for automated trading decisions');
    console.log('💡 Or use auto-monitor for continuous tracking');
    process.exit(0);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}, 1000);