#!/usr/bin/env node

/**
 * AUTO-TRADING MANAGER
 * Automatically manage positions based on profit levels
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

async function autoTradingManager() {
  console.log('🤖 AUTO-TRADING MANAGER\n');
  console.log('Analyzing positions for automated actions...\n');
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
    const ethStats = await makeRequest('GET', '/api/v1/market/stats?symbol=ETH-USDT');
    const btcStats = await makeRequest('GET', '/api/v1/market/stats?symbol=BTC-USDT');
    
    const ethPrice = parseFloat(ethTicker.price);
    const btcPrice = parseFloat(btcTicker.price);
    const ethChange24h = parseFloat(ethStats.changeRate) * 100;
    const btcChange24h = parseFloat(btcStats.changeRate) * 100;
    
    // Calculate P/L for each position
    const ethEntry = 2132.04;
    const btcEntry = 77548.00;
    
    const ethValue = ethAvailable * ethPrice;
    const btcValue = btcAvailable * btcPrice;
    const totalValue = ethValue + btcValue + usdtAvailable;
    
    const ethPnl = (ethPrice - ethEntry) * ethAvailable;
    const ethPnlPercent = ((ethPrice - ethEntry) / ethEntry * 100);
    
    const btcPnl = (btcPrice - btcEntry) * btcAvailable;
    const btcPnlPercent = ((btcPrice - btcEntry) / btcEntry * 100);
    
    const totalPnl = ethPnl + btcPnl;
    const totalPnlPercent = (totalPnl / totalValue * 100);
    
    console.log('💰 PORTFOLIO STATUS:');
    console.log(`   Total Value: $${totalValue.toFixed(2)}`);
    console.log(`   Combined P/L: $${totalPnl.toFixed(2)} (${totalPnlPercent > 0 ? '+' : ''}${totalPnlPercent.toFixed(2)}%)`);
    console.log('');
    
    console.log('📊 POSITION ANALYSIS:');
    console.log('');
    
    // ETH Analysis
    console.log('🔹 ETH-USDT:');
    console.log(`   Size: ${ethAvailable.toFixed(6)} ETH`);
    console.log(`   Value: $${ethValue.toFixed(2)}`);
    console.log(`   P/L: $${ethPnl.toFixed(2)} (${ethPnlPercent > 0 ? '+' : ''}${ethPnlPercent.toFixed(2)}%)`);
    console.log(`   24h Change: ${ethChange24h > 0 ? '+' : ''}${ethChange24h.toFixed(2)}%`);
    
    if (ethPnlPercent > 1) {
      console.log(`   🎯 STRONG PROFIT SIGNAL`);
      console.log(`   💡 RECOMMENDATION: Take 50% profits now`);
      console.log(`   💻 COMMAND: node auto-take-profit.js 50`);
    } else if (ethPnlPercent > 0.5) {
      console.log(`   ⚠️  MODERATE PROFIT`);
      console.log(`   💡 RECOMMENDATION: Consider partial profit taking`);
      console.log(`   💻 COMMAND: node auto-take-profit.js 25`);
    } else if (ethPnlPercent < -1) {
      console.log(`   ❌ SIGNIFICANT LOSS`);
      console.log(`   💡 RECOMMENDATION: Consider cutting losses`);
      console.log(`   💻 COMMAND: node auto-take-profit.js 100`);
    } else {
      console.log(`   ⏳ NORMAL RANGE`);
      console.log(`   💡 RECOMMENDATION: Continue monitoring`);
    }
    console.log('');
    
    // BTC Analysis
    console.log('🔹 BTC-USDT:');
    console.log(`   Size: ${btcAvailable.toFixed(8)} BTC`);
    console.log(`   Value: $${btcValue.toFixed(2)}`);
    console.log(`   P/L: $${btcPnl.toFixed(2)} (${btcPnlPercent > 0 ? '+' : ''}${btcPnlPercent.toFixed(2)}%)`);
    console.log(`   24h Change: ${btcChange24h > 0 ? '+' : ''}${btcChange24h.toFixed(2)}%`);
    
    if (btcPnlPercent > 1) {
      console.log(`   🎯 STRONG PROFIT SIGNAL`);
      console.log(`   💡 RECOMMENDATION: Take 50% profits now`);
      console.log(`   💻 COMMAND: node auto-take-profit.js 50`);
    } else if (btcPnlPercent > 0.5) {
      console.log(`   ⚠️  MODERATE PROFIT`);
      console.log(`   💡 RECOMMENDATION: Consider partial profit taking`);
      console.log(`   💻 COMMAND: node auto-take-profit.js 25`);
    } else if (btcPnlPercent < -1) {
      console.log(`   ❌ SIGNIFICANT LOSS`);
      console.log(`   💡 RECOMMENDATION: Consider cutting losses`);
      console.log(`   💻 COMMAND: node auto-take-profit.js 100`);
    } else {
      console.log(`   ⏳ NORMAL RANGE`);
      console.log(`   💡 RECOMMENDATION: Continue monitoring`);
    }
    console.log('');
    
    // Overall strategy
    console.log('🎯 AUTOMATED TRADING STRATEGY:');
    console.log('');
    
    if (totalPnlPercent > 1) {
      console.log('   ✅ PORTFOLIO STRONG PROFIT');
      console.log('   🎯 RECOMMENDATION: Secure 50% of profitable positions');
      console.log('   📊 RISK/REWARD: Favorable - take profits while ahead');
    } else if (totalPnlPercent > 0.5) {
      console.log('   ⚠️  PORTFOLIO MODERATE PROFIT');
      console.log('   🎯 RECOMMENDATION: Consider partial profit taking');
      console.log('   📊 RISK/REWARD: Balanced - maintain while monitoring');
    } else if (totalPnlPercent < -1) {
      console.log('   ❌ PORTFOLIO SIGNIFICANT LOSS');
      console.log('   🎯 RECOMMENDATION: Cut losses on losing positions');
      console.log('   📊 RISK/REWARD: Unfavorable - preserve capital');
    } else {
      console.log('   ⏳ PORTFOLIO IN NORMAL RANGE');
      console.log('   🎯 RECOMMENDATION: Continue monitoring');
      console.log('   📊 RISK/REWARD: Neutral - wait for clearer signals');
    }
    
    console.log('');
    console.log('💡 AUTOMATED ACTIONS:');
    
    let actions = [];
    
    if (ethPnlPercent > 1) {
      actions.push(`node auto-take-profit.js 50  # Take 50% ETH profits`);
    } else if (ethPnlPercent > 0.5) {
      actions.push(`node auto-take-profit.js 25  # Take 25% ETH profits`);
    }
    
    if (btcPnlPercent > 1) {
      actions.push(`node auto-take-profit.js 50  # Take 50% BTC profits`);
    } else if (btcPnlPercent > 0.5) {
      actions.push(`node auto-take-profit.js 25  # Take 25% BTC profits`);
    }
    
    if (actions.length === 0) {
      console.log('   ⏳ No automated actions required');
      console.log('   💡 Continue monitoring positions');
    } else {
      actions.forEach(action => {
        console.log(`   💻 ${action}`);
      });
    }
    
    console.log('');
    console.log('=' .repeat(60));
    console.log('✅ AUTO-TRADING MANAGER COMPLETE');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Auto-trading manager failed:', error.message);
  }
}

console.log('🤖 AUTO-TRADING MANAGER');
console.log('Analyzing positions for automated trading actions...\n');

setTimeout(() => {
  autoTradingManager().then(() => {
    console.log('\n💡 Run this periodically for automated trading decisions');
    console.log('💡 Execute recommended commands when appropriate');
    process.exit(0);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}, 1000);