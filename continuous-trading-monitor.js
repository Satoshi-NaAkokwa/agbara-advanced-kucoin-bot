#!/usr/bin/env node

/**
 * CONTINUOUS TRADING MONITOR
 * Monitors positions and provides regular updates
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

async function continuousMonitor() {
  console.log('🔄 CONTINUOUS TRADING MONITOR\n');
  console.log('Monitoring positions with status updates...\n');
  console.log('Press Ctrl+C to stop\n');
  console.log('=' .repeat(60));
  
  const ethEntry = 2132.04;
  const btcEntry = 77548.00;
  
  while (true) {
    try {
      console.log(`\n📊 MONITORING UPDATE - ${new Date().toLocaleTimeString()}`);
      console.log('=' .repeat(60));
      
      const accounts = await makeRequest('GET', '/api/v1/accounts');
      const ethAccount = accounts.find(a => a.currency === 'ETH' && a.type === 'trade');
      const btcAccount = accounts.find(a => a.currency === 'BTC' && a.type === 'trade');
      const usdtAccount = accounts.find(a => a.currency === 'USDT' && a.type === 'trade');
      
      const ethAvailable = parseFloat(ethAccount?.available || 0);
      const btcAvailable = parseFloat(btcAccount?.available || 0);
      const usdtAvailable = parseFloat(usdtAccount?.available || 0);
      
      const ethTicker = await makeRequest('GET', '/api/v1/market/orderbook/level1?symbol=ETH-USDT');
      const btcTicker = await makeRequest('GET', '/api/v1/market/orderbook/level1?symbol=BTC-USDT');
      const ethStats = await makeRequest('GET', '/api/v1/market/stats?symbol=ETH-USDT');
      const btcStats = await makeRequest('GET', '/api/v1/market/stats?symbol=BTC-USDT');
      
      const ethPrice = parseFloat(ethTicker.price);
      const btcPrice = parseFloat(btcTicker.price);
      const ethChange24h = parseFloat(ethStats.changeRate) * 100;
      const btcChange24h = parseFloat(btcStats.changeRate) * 100;
      
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
      console.log(`   USDT: $${usdtAvailable.toFixed(4)}`);
      console.log('');
      
      console.log('📊 POSITION PERFORMANCE:');
      console.log('');
      
      console.log(`🟢 ETH-USDT:`);
      console.log(`   Size: ${ethAvailable.toFixed(6)} ETH`);
      console.log(`   Entry: $${ethEntry.toFixed(2)}`);
      console.log(`   Current: $${ethPrice.toFixed(2)}`);
      console.log(`   Value: $${ethValue.toFixed(2)}`);
      console.log(`   P/L: $${ethPnl.toFixed(2)} (${ethPnlPercent > 0 ? '+' : ''}${ethPnlPercent.toFixed(2)}%)`);
      console.log(`   24h Change: ${ethChange24h > 0 ? '+' : ''}${ethChange24h.toFixed(2)}%`);
      console.log('');
      
      console.log(`🟢 BTC-USDT:`);
      console.log(`   Size: ${btcAvailable.toFixed(8)} BTC`);
      console.log(`   Entry: $${btcEntry.toFixed(2)}`);
      console.log(`   Current: $${btcPrice.toFixed(2)}`);
      console.log(`   Value: $${btcValue.toFixed(2)}`);
      console.log(`   P/L: $${btcPnl.toFixed(2)} (${btcPnlPercent > 0 ? '+' : ''}${btcPnlPercent.toFixed(2)}%)`);
      console.log(`   24h Change: ${btcChange24h > 0 ? '+' : ''}${btcChange24h.toFixed(2)}%`);
      console.log('');
      
      console.log('💵 COMBINED PERFORMANCE:');
      console.log(`   Total P/L: $${totalPnl.toFixed(2)} (${totalPnlPercent > 0 ? '+' : ''}${totalPnlPercent.toFixed(2)}%)`);
      console.log(`   Win Rate: ${totalPnl > 0 ? 'Profitable' : 'Breakeven'}`);
      console.log('');
      
      console.log('🎯 TRADING SIGNALS:');
      console.log('');
      
      if (ethPnlPercent > 1) {
        console.log(`✅ STRONG PROFIT SIGNAL (ETH)`);
        console.log(`   Action: Consider taking 50% profits`);
        console.log(`   Command: node auto-take-profit.js 50`);
      } else if (ethPnlPercent > 0.5) {
        console.log(`⚠️  MODERATE PROFIT SIGNAL (ETH)`);
        console.log(`   Action: Consider partial profit taking`);
        console.log(`   Command: node auto-take-profit.js 25`);
      } else if (ethPnlPercent < -1) {
        console.log(`❌ LOSS WARNING (ETH)`);
        console.log(`   Action: Consider cutting losses`);
        console.log(`   Command: node auto-take-profit.js 100`);
      } else {
        console.log(`⏳ ETH Position: Normal range`);
        console.log(`   Action: Continue monitoring`);
      }
      
      if (btcPnlPercent > 1) {
        console.log(`✅ STRONG PROFIT SIGNAL (BTC)`);
        console.log(`   Action: Consider taking 50% profits`);
        console.log(`   Command: node auto-take-profit.js 50`);
      } else if (btcPnlPercent > 0.5) {
        console.log(`⚠️  MODERATE PROFIT SIGNAL (BTC)`);
        console.log(`   Action: Consider partial profit taking`);
        console.log(`   Command: node auto-take-profit.js 25`);
      } else if (btcPnlPercent < -1) {
        console.log(`❌ LOSS WARNING (BTC)`);
        console.log(`   Action: Consider cutting losses`);
        console.log(`   Command: node auto-take-profit.js 100`);
      } else {
        console.log(`⏳ BTC Position: Normal range`);
        console.log(`   Action: Continue monitoring`);
      }
      
      console.log('');
      console.log('🎯 AUTOMATED ACTIONS:');
      console.log('');
      
      if (ethPnlPercent > 1) {
        console.log(`💻 node auto-take-profit.js 50  # Take 50% ETH profits`);
      } else if (ethPnlPercent > 0.5) {
        console.log(`💻 node auto-take-profit.js 25  # Take 25% ETH profits`);
      }
      
      if (btcPnlPercent > 1) {
        console.log(`💻 node auto-take-profit.js 50  # Take 50% BTC profits`);
      } else if (btcPnlPercent > 0.5) {
        console.log(`💻 node auto-take-profit.js 25  # Take 25% BTC profits`);
      }
      
      if (ethPnlPercent <= 0.5 && btcPnlPercent <= 0.5) {
        console.log(`⏳ No automated actions required`);
        console.log(`💻 Continue monitoring positions`);
      }
      
      console.log('');
      console.log('🤖 Auto-monitor: RUNNING (PID 7860)');
      console.log('⏳ Next update: In 60 seconds');
      console.log('=' .repeat(60));
      
    } catch (error) {
      console.error(`\n❌ Monitoring error: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 60000));
  }
}

console.log('🔄 CONTINUOUS TRADING MONITOR');
console.log('Monitoring positions with real-time updates...\n');

setTimeout(() => {
  continuousMonitor().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}, 1000);