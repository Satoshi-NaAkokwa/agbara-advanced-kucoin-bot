#!/usr/bin/env node

/**
 * FIX THE FUNDS INCREMENT ERROR
 * The error "Funds increment invalid" means the order size doesn't meet KuCoin's requirements
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

async function diagnoseFundsError() {
  console.log('🔍 DIAGNOSING FUNDS INCREMENT ERROR\n');
  console.log('=' .repeat(60));
  
  try {
    // Get current balance
    const accounts = await makeRequest('GET', '/api/v1/accounts');
    const usdtAccount = accounts.find(a => a.currency === 'USDT' && a.type === 'trade');
    const usdtAvailable = parseFloat(usdtAccount?.available || 0);
    
    console.log('💰 Current USDT balance:', usdtAvailable.toFixed(4));
    console.log('');
    
    // Check trading pair requirements
    const tradingPairs = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT'];
    
    for (const pair of tradingPairs) {
      console.log(`📏 ${pair} Requirements:`);
      
      try {
        const symbolInfo = await makeRequest('GET', `/api/v1/symbols/${pair}`);
        const ticker = await makeRequest('GET', `/api/v1/market/orderbook/level1?symbol=${pair}`);
        
        const currentPrice = parseFloat(ticker.price);
        const minFunds = parseFloat(symbolInfo.minFunds);
        const baseIncrement = parseFloat(symbolInfo.baseIncrement);
        const quoteIncrement = parseFloat(symbolInfo.quoteIncrement);
        const priceIncrement = parseFloat(symbolInfo.priceIncrement);
        
        console.log(`   Min Funds: $${minFunds}`);
        console.log(`   Size Increment: ${baseIncrement}`);
        console.log(`   Price Increment: ${priceIncrement}`);
        console.log(`   Current Price: $${currentPrice.toFixed(2)}`);
        
        // Calculate minimum valid order
        const minSizeRequired = Math.ceil(minFunds / currentPrice / baseIncrement) * baseIncrement;
        const minOrderValue = minSizeRequired * currentPrice;
        
        console.log(`   Minimum Size: ${minSizeRequired.toFixed(8)} base`);
        console.log(`   Minimum Value: $${minOrderValue.toFixed(2)}`);
        
        // Calculate what the bot is trying to use
        const botAttemptSize = 3.01 / currentPrice;
        const botAttemptValue = 3.01;
        
        console.log(`   Bot Attempt Size: ${botAttemptSize.toFixed(8)} base`);
        console.log(`   Bot Attempt Value: $${botAttemptValue.toFixed(2)}`);
        
        // Check if bot attempt is valid
        const isSizeValid = Math.abs(botAttemptSize / baseIncrement - Math.floor(botAttemptSize / baseIncrement)) < 0.000001;
        const isValueValid = botAttemptValue >= minFunds;
        const isPriceValid = Math.abs(currentPrice / priceIncrement - Math.floor(currentPrice / priceIncrement)) < 0.000001;
        
        console.log(`   Size Valid: ${isSizeValid ? '✅' : '❌'}`);
        console.log(`   Value Valid: ${isValueValid ? '✅' : '❌'}`);
        console.log(`   Price Valid: ${isPriceValid ? '✅' : '❌'}`);
        
        if (!isSizeValid) {
          const correctSize = Math.floor(botAttemptSize / baseIncrement) * baseIncrement;
          console.log(`   ⚠️  Should use size: ${correctSize.toFixed(8)} base`);
        }
        
        if (!isPriceValid) {
          const correctPrice = Math.floor(currentPrice / priceIncrement) * priceIncrement;
          console.log(`   ⚠️  Should use price: $${correctPrice.toFixed(2)}`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
      
      console.log('');
    }
    
    console.log('=' .repeat(60));
    console.log('🎯 DIAGNOSIS COMPLETE');
    console.log('');
    console.log('The error "Funds increment invalid" means:');
    console.log('1. Order size doesn\'t match base increment requirement');
    console.log('2. Order value is below minimum funds requirement');
    console.log('3. Price doesn\'t match price increment requirement');
    console.log('');
    console.log('FIX NEEDED:');
    console.log('• Update order calculation to use proper increments');
    console.log('• Ensure all prices are rounded to valid increments');
    console.log('• Ensure all sizes are rounded to valid increments');
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
  }
}

diagnoseFundsError();