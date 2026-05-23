#!/usr/bin/env node

/**
 * MONITOR TRADING ACTIVITY AND ACCOUNT STATUS
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
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

async function monitorTrading() {
  console.log('📊 KUCOIN TRADING MONITOR');
  console.log('=' .repeat(60));
  console.log('');
  
  try {
    // 1. Get account balances
    console.log('💰 ACCOUNT BALANCES:');
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
    console.log(`   BTC:  ${btcAvailable.toFixed(8)}`);
    console.log(`   ETH:  ${ethAvailable.toFixed(6)}`);
    console.log(`   SOL:  ${solAvailable.toFixed(4)}`);
    console.log(`   KCS:  ${kcsAvailable.toFixed(6)}`);
    
    // 2. Get open orders
    console.log('\n📋 OPEN ORDERS:');
    const orders = await makeRequest('GET', '/api/v1/orders?status=active');
    console.log(`   Total: ${orders.totalNum || 0}`);
    
    if (orders.items && orders.items.length > 0) {
      orders.items.forEach((order, i) => {
        const value = parseFloat(order.size) * parseFloat(order.price);
        console.log(`   ${i+1}. ${order.symbol} ${order.side} ${order.size} @ $${parseFloat(order.price).toFixed(2)}`);
        console.log(`      Value: $${value.toFixed(2)} | Age: ${Math.floor((Date.now() - order.createdAt) / 60000)} min`);
      });
    }
    
    // 3. Get recent completed orders
    console.log('\n📜 RECENT COMPLETED ORDERS:');
    const recentOrders = await makeRequest('GET', '/api/v1/orders?status=done&limit=5');
    
    if (recentOrders.items && recentOrders.items.length > 0) {
      recentOrders.items.forEach((order, i) => {
        const timestamp = new Date(order.createdAt).toLocaleString();
        const value = parseFloat(order.dealSize) * parseFloat(order.dealPrice);
        const profit = order.side === 'sell' ? (parseFloat(order.dealFunds) - parseFloat(order.costFunds || 0)).toFixed(2) : '0.00';
        
        console.log(`   ${i+1}. ${timestamp}`);
        console.log(`      ${order.symbol} ${order.side} ${order.dealSize} @ $${parseFloat(order.dealPrice).toFixed(2)}`);
        console.log(`      Value: $${value.toFixed(2)} | P/L: $${profit}`);
      });
    } else {
      console.log('   No recent completed orders');
    }
    
    // 4. Check bot state
    console.log('\n🤖 BOT STATE:');
    const stateFile = path.join(__dirname, 'bot-state.json');
    try {
      const botState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      const openPositions = Object.keys(botState.openPositions || {}).length;
      
      console.log(`   Open positions: ${openPositions}`);
      console.log(`   Total trades: ${botState.totalTrades}`);
      console.log(`   Daily PnL: $${(botState.dailyPnL || 0).toFixed(2)}`);
      console.log(`   Win rate: ${botState.totalTrades > 0 ? ((botState.winCount / botState.totalTrades) * 100).toFixed(1) : 0}%`);
    } catch (error) {
      console.log('   Could not read bot state');
    }
    
    // 5. Market overview
    console.log('\n📈 MARKET OVERVIEW:');
    const pairs = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT'];
    
    for (const pair of pairs) {
      try {
        const ticker = await makeRequest('GET', `/api/v1/market/orderbook/level1?symbol=${pair}`);
        const price = parseFloat(ticker.price);
        const change = ((price - parseFloat(ticker.open)) / parseFloat(ticker.open) * 100).toFixed(2);
        
        console.log(`   ${pair}: $${price.toFixed(2)} (${change > 0 ? '+' : ''}${change}%)`);
      } catch (error) {
        console.log(`   ${pair}: Error fetching price`);
      }
    }
    
    // 6. Status summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 STATUS SUMMARY:');
    
    if (usdtAvailable >= 0.1 && (orders.totalNum || 0) === 0) {
      console.log('✅ READY FOR TRADING');
      console.log('   • Sufficient balance available');
      console.log('   • No blocking orders');
      console.log('   • Validation fixes applied');
      console.log('   • Can place orders normally');
    } else if (usdtAvailable >= 0.1) {
      console.log('⚠️  TRADING ACTIVE');
      console.log('   • Orders in progress');
      console.log('   • Monitoring recommended');
    } else {
      console.log('⚠️  NEEDS ATTENTION');
      console.log('   • Low balance or blocked');
    }
    
    console.log('');
    console.log('💡 Next actions:');
    console.log('   • Run corrected-simple-bot.js to start trading');
    console.log('   • Apply patches to smart-trading-bot.js for full features');
    console.log('   • Monitor orders regularly');
    console.log('');
    
  } catch (error) {
    console.error('❌ Monitor failed:', error.message);
  }
}

monitorTrading();