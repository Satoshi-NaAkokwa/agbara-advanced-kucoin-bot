#!/usr/bin/env node

/**
 * AUTOMATED POSITION MONITOR
 * Continuously monitors ETH position and provides real-time updates
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

async function monitorPosition() {
  console.log('🔄 CONTINUOUS POSITION MONITORING...\n');
  console.log('Press Ctrl+C to stop\n');
  console.log('=' .repeat(60));
  
  const entryPrice = 2132.04; // From earlier trade
  const stopLoss = entryPrice * 0.97; // 3% stop loss
  const takeProfit = entryPrice * 1.05; // 5% take profit
  
  while (true) {
    try {
      console.log(`\n📊 MONITORING UPDATE - ${new Date().toLocaleTimeString()}`);
      console.log('=' .repeat(60));
      
      // Get account balances
      const accounts = await makeRequest('GET', '/api/v1/accounts');
      const ethAccount = accounts.find(a => a.currency === 'ETH' && a.type === 'trade');
      const usdtAccount = accounts.find(a => a.currency === 'USDT' && a.type === 'trade');
      
      const ethAvailable = parseFloat(ethAccount?.available || 0);
      const usdtAvailable = parseFloat(usdtAccount?.available || 0);
      
      // Get current price
      const ticker = await makeRequest('GET', '/api/v1/market/orderbook/level1?symbol=ETH-USDT');
      const currentPrice = parseFloat(ticker.price);
      const positionValue = ethAvailable * currentPrice;
      
      // Calculate PnL
      const pnl = (currentPrice - entryPrice) * ethAvailable;
      const pnlPercent = ((currentPrice - entryPrice) / entryPrice * 100);
      
      console.log('💰 POSITION STATUS:');
      console.log(`   Size: ${ethAvailable.toFixed(6)} ETH`);
      console.log(`   Entry: $${entryPrice.toFixed(2)}`);
      console.log(`   Current: $${currentPrice.toFixed(2)}`);
      console.log(`   Value: $${positionValue.toFixed(2)}`);
      console.log(`   P/L: $${pnl.toFixed(2)} (${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`);
      
      // Check trading signals
      console.log('\n🎯 TRADING SIGNALS:');
      
      if (currentPrice >= takeProfit) {
        console.log(`✅ TAKE PROFIT REACHED!`);
        console.log(`   Target: $${takeProfit.toFixed(2)} | Current: $${currentPrice.toFixed(2)}`);
        console.log(`   Consider closing position for profit`);
      } else if (currentPrice <= stopLoss) {
        console.log(`❌ STOP LOSS HIT!`);
        console.log(`   Stop: $${stopLoss.toFixed(2)} | Current: $${currentPrice.toFixed(2)}`);
        console.log(`   Consider closing to limit losses`);
      } else if (pnlPercent >= 3) {
        console.log(`⚠️  STRONG PROFIT SIGNAL`);
        console.log(`   Up ${pnlPercent.toFixed(1)}% - Consider taking profits`);
      } else if (pnlPercent <= -2) {
        console.log(`⚠️  LOSS WARNING`);
        console.log(`   Down ${Math.abs(pnlPercent).toFixed(1)}% - Monitor closely`);
      } else {
        console.log(`⏳ HOLDING - Position in range`);
      }
      
      // Check 24h change
      const stats = await makeRequest('GET', '/api/v1/market/stats?symbol=ETH-USDT');
      const change24h = parseFloat(stats.changeRate) * 100;
      
      console.log(`\n📈 MARKET CONTEXT:`);
      console.log(`   24h Change: ${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}%`);
      console.log(`   Vol: ${(parseFloat(stats.vol) * currentPrice / 1000000).toFixed(2)}M`);
      
      // Trading advice
      console.log(`\n💡 CURRENT ADVICE:`);
      
      if (usdtAvailable >= 0.1) {
        console.log(`   ✅ USDT available: $${usdtAvailable.toFixed(4)}`);
        console.log(`   Could open additional positions`);
        console.log(`   Run corrected-simple-bot.js to trade`);
      } else {
        console.log(`   ⚠️  Low USDT: $${usdtAvailable.toFixed(4)}`);
        console.log(`   Focus on current ETH position`);
        console.log(`   Wait for exit signal`);
      }
      
      console.log('\n' + '=' .repeat(60));
      
    } catch (error) {
      console.error(`\n❌ Monitoring error: ${error.message}`);
    }
    
    // Wait 30 seconds before next update
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
}

console.log('🎯 AUTOMATED POSITION MONITOR');
console.log('Monitoring ETH-USDT position in real-time...\n');

monitorPosition().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});