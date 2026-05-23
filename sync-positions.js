#!/usr/bin/env node

/**
 * Position Recovery Script
 * Checks actual positions on KuCoin and syncs with bot state
 */

require('dotenv').config();
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'bot-state.json');

// API credentials
const apiKey = process.env.KUCOIN_API_KEY;
const secretKey = process.env.KUCOIN_SECRET_KEY;
const passphrase = process.env.KUCOIN_API_PASSPHRASE;
const baseUrl = 'api.kucoin.com';

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
      hostname: baseUrl,
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
            reject(new Error(`KuCoin API Error: ${result.msg} (Code: ${result.code})`));
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

async function getOpenOrders() {
  try {
    const orders = await makeRequest('GET', '/api/v1/orders?status=active');
    console.log(`📊 Found ${orders.items.length} active orders`);
    return orders.items;
  } catch (error) {
    console.error(`❌ Error fetching orders: ${error.message}`);
    return [];
  }
}

async function getAccounts() {
  try {
    const accounts = await makeRequest('GET', '/api/v1/accounts');
    const tradingAccounts = accounts.filter(acc => acc.type === 'trade');
    
    console.log('💰 Current Trading Account Balances:');
    tradingAccounts.forEach(acc => {
      if (parseFloat(acc.balance) > 0) {
        console.log(`   ${acc.currency}: ${acc.balance} (${acc.available} available)`);
      }
    });
    
    return tradingAccounts;
  } catch (error) {
    console.error(`❌ Error fetching accounts: ${error.message}`);
    return [];
  }
}

async function syncPositions() {
  console.log('🔄 Syncing positions with KuCoin...');
  
  // Get actual positions from exchange
  const orders = await getOpenOrders();
  const accounts = await getAccounts();
  
  // Load current state
  let state = { openPositions: {}, portfolio: { assets: {} } };
  try {
    if (fs.existsSync(STATE_FILE)) {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (error) {
    console.log('Starting with fresh state');
  }
  
  // Check for discrepancies
  const hasActivePositions = accounts.some(acc => 
    acc.currency !== 'USDT' && parseFloat(acc.balance) > 0
  );
  
  if (hasActivePositions && Object.keys(state.openPositions).length === 0) {
    console.log('\n⚠️  WARNING: You have assets but no positions tracked in bot state!');
    console.log('This means:');
    console.log('   • Previous positions may have been closed manually');
    console.log('   • Or bot state was reset');
    console.log('   • Bot will continue monitoring but not tracking these positions');
  }
  
  console.log('\n✅ Position sync complete');
  console.log(`   Bot tracking: ${Object.keys(state.openPositions).length} positions`);
  console.log(`   Exchange positions: ${hasActivePositions ? 'Yes' : 'None'}`);
}

// Run sync
syncPositions();