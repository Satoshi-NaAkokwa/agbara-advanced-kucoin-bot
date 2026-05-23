#!/usr/bin/env node

/**
 * Verify the position closure and get current account state
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

async function verifyPositionClosure() {
  console.log('🔍 Verifying Position Closure and Account State...\n');
  
  try {
    // 1. Get current balances
    const accounts = await makeRequest('GET', '/api/v1/accounts');
    
    const usdtAccount = accounts.find(a => a.currency === 'USDT' && a.type === 'trade');
    const btcAccount = accounts.find(a => a.currency === 'BTC' && a.type === 'trade');
    const ethAccount = accounts.find(a => a.currency === 'ETH' && a.type === 'trade');
    const kcsAccount = accounts.find(a => a.currency === 'KCS' && a.type === 'trade');
    
    const usdtAvailable = parseFloat(usdtAccount?.available || 0);
    const btcAvailable = parseFloat(btcAccount?.available || 0);
    const ethAvailable = parseFloat(ethAccount?.available || 0);
    const kcsAvailable = parseFloat(kcsAccount?.available || 0);
    
    console.log('💰 Current Account Balances:');
    console.log(`   USDT: ${usdtAvailable.toFixed(4)}`);
    console.log(`   BTC:  ${btcAvailable.toFixed(8)}`);
    console.log(`   ETH:  ${ethAvailable.toFixed(6)}`);
    console.log(`   KCS:  ${kcsAvailable.toFixed(6)}`);
    
    // 2. Get current prices
    const btcTicker = await makeRequest('GET', '/api/v1/market/orderbook/level1?symbol=BTC-USDT');
    const ethTicker = await makeRequest('GET', '/api/v1/market/orderbook/level1?symbol=ETH-USDT');
    
    const btcPrice = parseFloat(btcTicker.price);
    const ethPrice = parseFloat(ethTicker.price);
    
    console.log('\n📊 Current Prices:');
    console.log(`   BTC: $${btcPrice.toFixed(2)}`);
    console.log(`   ETH: $${ethPrice.toFixed(2)}`);
    
    // 3. Calculate portfolio value
    const btcValue = btcAvailable * btcPrice;
    const ethValue = ethAvailable * ethPrice;
    const kcsValue = kcsAvailable * 1.5; // Approximate KCS value
    const totalValue = usdtAvailable + btcValue + ethValue + kcsValue;
    
    console.log('\n💼 Portfolio Value:');
    console.log(`   USDT: $${usdtAvailable.toFixed(2)} (${(usdtAvailable/totalValue*100).toFixed(1)}%)`);
    console.log(`   BTC:  $${btcValue.toFixed(2)} (${(btcValue/totalValue*100).toFixed(1)}%)`);
    console.log(`   ETH:  $${ethValue.toFixed(2)} (${(ethValue/totalValue*100).toFixed(1)}%)`);
    console.log(`   KCS:  $${kcsValue.toFixed(2)} (${(kcsValue/totalValue*100).toFixed(1)}%)`);
    console.log(`   TOTAL: $${totalValue.toFixed(2)}`);
    
    // 4. Check for stuck position
    console.log('\n🚨 Stuck Position Check:');
    
    if (btcAvailable < 0.000001) {
      console.log('   ✅ No BTC stuck position detected');
      console.log('   BTC balance is negligible, position successfully closed');
    } else {
      console.log(`   ⚠️  BTC balance still significant: ${btcAvailable.toFixed(8)}`);
      console.log(`   Value: $${btcValue.toFixed(2)}`);
      
      if (btcValue < 0.1) {
        console.log('   Position value below minimum, still stuck!');
      } else {
        console.log('   Position meets minimum requirements, can be closed');
      }
    }
    
    // 5. Check open orders
    const orders = await makeRequest('GET', '/api/v1/orders?status=active');
    console.log('\n📋 Open Orders:');
    console.log(`   Total: ${orders.totalNum || 0}`);
    
    if (orders.items && orders.items.length > 0) {
      console.log('   Order details:');
      orders.items.forEach((order, i) => {
        console.log(`   ${i+1}. ${order.symbol} ${order.side} ${order.size} @ ${order.price}`);
        console.log(`      ID: ${order.id}`);
      });
    }
    
    // 6. Update bot state if position is closed
    if (btcAvailable < 0.000001) {
      console.log('\n🔄 Updating bot state...');
      
      const fs = require('fs');
      const path = require('path');
      const stateFile = path.join(__dirname, 'bot-state.json');
      
      const newState = {
        portfolio: {
          usdt: usdtAvailable,
          totalValue: totalValue,
          assets: {
            USDT: usdtAvailable,
            ETH: ethAvailable,
            KCS: kcsAvailable
          }
        },
        openPositions: [],
        tradeHistory: [],
        dailyPnL: 0,
        totalTrades: 0,
        winCount: 0,
        lossCount: 0,
        strategyPerformance: {
          momentum: { wins: 0, losses: 0, totalProfit: 0, trades: [] },
          scalping: { wins: 0, losses: 0, totalProfit: 0, trades: [] },
          meanReversion: { wins: 0, losses: 0, totalProfit: 0, trades: [] },
          moonshot: { wins: 0, losses: 0, totalProfit: 0, trades: [] }
        },
        marketSentiment: "NEUTRAL",
        fearGreedIndex: 50,
        config: {
          momentum: 0.35,
          scalping: 0.25,
          meanReversion: 0.25,
          moonshot: 0.15,
          reserve: 0.1
        },
        lastSaved: Date.now()
      };
      
      fs.writeFileSync(stateFile, JSON.stringify(newState, null, 2));
      console.log('✅ Bot state updated successfully');
    }
    
    console.log('\n' + '=' .repeat(60));
    
    if (btcAvailable < 0.000001) {
      console.log('✅ POSITION CLOSED SUCCESSFULLY');
      console.log('Your KuCoin bot is ready to start fresh');
      console.log('Configuration fixes applied and bot state updated');
      return true;
    } else {
      console.log('⚠️  POSITION STILL EXISTS');
      console.log('Additional action may be required');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    return false;
  }
}

verifyPositionClosure().then(success => {
  if (success) {
    console.log('\n🚀 Ready to restart bot');
  } else {
    console.log('\n🔧 Manual intervention may still be needed');
  }
  process.exit(success ? 0 : 1);
});