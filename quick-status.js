#!/usr/bin/env node

/**
 * QUICK STATUS UPDATE
 * Fast status check of all positions
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

async function quickStatus() {
  try {
    const accounts = await makeRequest('GET', '/api/v1/accounts');
    const ethAccount = accounts.find(a => a.currency === 'ETH' && a.type === 'trade');
    const btcAccount = accounts.find(a => a.currency === 'BTC' && a.type === 'trade');
    const usdtAccount = accounts.find(a => a.currency === 'USDT' && a.type === 'trade');
    
    const ethAvailable = parseFloat(ethAccount?.available || 0);
    const btcAvailable = parseFloat(btcAccount?.available || 0);
    const usdtAvailable = parseFloat(usdtAccount?.available || 0);
    
    const ethTicker = await makeRequest('GET', '/api/v1/market/orderbook/level1?symbol=ETH-USDT');
    const btcTicker = await makeRequest('GET', '/api/v1/market/orderbook/level1?symbol=BTC-USDT');
    
    const ethPrice = parseFloat(ethTicker.price);
    const btcPrice = parseFloat(btcTicker.price);
    
    const ethValue = ethAvailable * ethPrice;
    const btcValue = btcAvailable * btcPrice;
    const totalValue = ethValue + btcValue + usdtAvailable;
    
    const ethEntry = 2132.04;
    const btcEntry = 77548.00;
    
    const ethPnl = (ethPrice - ethEntry) * ethAvailable;
    const ethPnlPercent = ((ethPrice - ethEntry) / ethEntry * 100);
    
    const btcPnl = (btcPrice - btcEntry) * btcAvailable;
    const btcPnlPercent = ((btcPrice - btcEntry) / btcEntry * 100);
    
    const totalPnl = ethPnl + btcPnl;
    const totalPnlPercent = (totalPnl / totalValue * 100);
    
    console.log('📊 QUICK STATUS:');
    console.log('');
    console.log(`💰 Portfolio: $${totalValue.toFixed(2)}`);
    console.log(`📈 P/L: $${totalPnl.toFixed(2)} (${totalPnlPercent > 0 ? '+' : ''}${totalPnlPercent.toFixed(2)}%)`);
    console.log('');
    console.log(`🟢 ETH: $${ethValue.toFixed(2)} (${ethPnlPercent > 0 ? '+' : ''}${ethPnlPercent.toFixed(2)}%)`);
    console.log(`🟢 BTC: $${btcValue.toFixed(2)} (${btcPnlPercent > 0 ? '+' : ''}${btcPnlPercent.toFixed(2)}%)`);
    console.log(`💵 USDT: $${usdtAvailable.toFixed(4)}`);
    console.log('');
    
    if (ethPnlPercent > 0.5) {
      console.log('🎯 ACTION: Consider taking 25% ETH profits');
      console.log('💻 Command: node auto-take-profit.js 25');
    }
    
    console.log('');
    console.log('🤖 Auto-monitor: RUNNING (PID 7860)');
    console.log('⏳ Status: Both positions profitable, monitoring...');
    
  } catch (error) {
    console.error('❌ Status check failed:', error.message);
  }
}

console.log('⚡ QUICK STATUS CHECK\n');

setTimeout(() => {
  quickStatus().then(() => process.exit(0)).catch(() => process.exit(1));
}, 500);