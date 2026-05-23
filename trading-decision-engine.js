#!/usr/bin/env node

/**
 * TRADING DECISION ENGINE
 * Analyzes position and provides automated trading recommendations
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

async function tradingDecision() {
  console.log('🧠 TRADING DECISION ENGINE\n');
  console.log('Analyzing position and market conditions...\n');
  console.log('=' .repeat(60));
  
  try {
    // Get account balances
    const accounts = await makeRequest('GET', '/api/v1/accounts');
    const ethAccount = accounts.find(a => a.currency === 'ETH' && a.type === 'trade');
    const usdtAccount = accounts.find(a => a.currency === 'USDT' && a.type === 'trade');
    
    const ethAvailable = parseFloat(ethAccount?.available || 0);
    const usdtAvailable = parseFloat(usdtAccount?.available || 0);
    
    // Get current price
    const ticker = await makeRequest('GET', '/api/v1/market/orderbook/level1?symbol=ETH-USDT');
    const currentPrice = parseFloat(ticker.price);
    
    // Get market stats
    const stats = await makeRequest('GET', '/api/v1/market/stats?symbol=ETH-USDT');
    const change24h = parseFloat(stats.changeRate) * 100;
    const high24h = parseFloat(stats.high);
    const low24h = parseFloat(stats.low);
    
    // Get order book for market depth
    const orderbook = await makeRequest('GET', '/api/v1/market/orderbook/level2_20?symbol=ETH-USDT');
    const bids = orderbook.bids.map(b => parseFloat(b[0])).slice(0, 5);
    const asks = orderbook.asks.map(a => parseFloat(a[0])).slice(0, 5);
    const bestBid = bids[0];
    const bestAsk = asks[0];
    const spread = ((bestAsk - bestBid) / bestBid * 100).toFixed(4);
    
    console.log('📊 MARKET ANALYSIS:');
    console.log(`   Current Price: $${currentPrice.toFixed(2)}`);
    console.log(`   24h Change: ${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}%`);
    console.log(`   24h High: $${high24h.toFixed(2)}`);
    console.log(`   24h Low: $${low24h.toFixed(2)}`);
    console.log(`   Best Bid: $${bestBid.toFixed(2)}`);
    console.log(`   Best Ask: $${bestAsk.toFixed(2)}`);
    console.log(`   Spread: ${spread}%`);
    console.log('');
    
    // Position analysis
    const entryPrice = 2132.04; // From earlier trade
    const positionValue = ethAvailable * currentPrice;
    const pnl = (currentPrice - entryPrice) * ethAvailable;
    const pnlPercent = ((currentPrice - entryPrice) / entryPrice * 100);
    
    // Technical indicators
    const inUpperHalf = currentPrice > ((high24h + low24h) / 2);
    const nearHigh = (currentPrice / high24h) > 0.95;
    const nearLow = (currentPrice / low24h) < 1.05;
    const bullishTrend = change24h > 0;
    const bearishTrend = change24h < 0;
    
    // Risk analysis
    const stopLossDistance = ((entryPrice * 0.97 - currentPrice) / currentPrice * 100);
    const takeProfitDistance = ((entryPrice * 1.05 - currentPrice) / currentPrice * 100);
    
    console.log('📈 TECHNICAL ANALYSIS:');
    console.log(`   Position in 24h Range: ${inUpperHalf ? 'Upper Half' : 'Lower Half'}`);
    console.log(`   Near 24h High: ${nearHigh ? 'Yes (within 5%)' : 'No'}`);
    console.log(`   Near 24h Low: ${nearLow ? 'Yes (within 5%)' : 'No'}`);
    console.log(`   Trend: ${bullishTrend ? 'Bullish' : bearishTrend ? 'Bearish' : 'Neutral'}`);
    console.log('');
    
    console.log('🎯 RISK/REWARD ANALYSIS:');
    console.log(`   Stop Loss Distance: ${stopLossDistance.toFixed(2)}% (at $${(entryPrice * 0.97).toFixed(2)})`);
    console.log(`   Take Profit Distance: ${takeProfitDistance.toFixed(2)}% (at $${(entryPrice * 1.05).toFixed(2)})`);
    console.log(`   Risk/Reward Ratio: 1:${Math.abs(takeProfitDistance / stopLossDistance).toFixed(2)}`);
    console.log('');
    
    // Decision matrix
    let decision = {
      action: 'HOLD',
      confidence: 50,
      reasoning: [],
      riskLevel: 'MEDIUM'
    };
    
    // Analyze factors
    if (pnlPercent > 1) {
      decision.confidence += 15;
      decision.reasoning.push('Position is profitable (+1%+)');
    }
    
    if (pnlPercent < -1) {
      decision.confidence -= 15;
      decision.reasoning.push('Position is losing (-1%+)');
    }
    
    if (bullishTrend && pnlPercent > 0) {
      decision.confidence += 10;
      decision.reasoning.push('Positive trend with profit');
    }
    
    if (bearishTrend && pnlPercent < 0) {
      decision.confidence -= 10;
      decision.reasoning.push('Negative trend with loss');
    }
    
    if (nearHigh && pnlPercent > 0) {
      decision.reasoning.push('Near 24h high - consider taking profits');
      decision.action = 'REDUCE_POSITION';
    }
    
    if (nearLow && pnlPercent < 0) {
      decision.reasoning.push('Near 24h low - be cautious');
      decision.riskLevel = 'HIGH';
    }
    
    if (Math.abs(pnlPercent) < 0.5) {
      decision.reasoning.push('Position near breakeven - wait for direction');
      decision.action = 'HOLD';
      decision.confidence = 60;
    }
    
    // Final decision
    if (decision.confidence > 70 && pnlPercent > 0.5) {
      decision.action = 'TAKE_PARTIAL_PROFIT';
      decision.riskLevel = 'LOW';
    } else if (decision.confidence < 30 && pnlPercent < -1) {
      decision.action = 'REDUCE_POSITION';
      decision.riskLevel = 'HIGH';
    } else if (pnlPercent > 2) {
      decision.action = 'TAKE_PROFIT';
      decision.riskLevel = 'LOW';
    } else if (pnlPercent < -2) {
      decision.action = 'CUT_LOSS';
      decision.riskLevel = 'HIGH';
    }
    
    console.log('💰 POSITION STATUS:');
    console.log(`   Size: ${ethAvailable.toFixed(6)} ETH`);
    console.log(`   Entry: $${entryPrice.toFixed(2)}`);
    console.log(`   Current: $${currentPrice.toFixed(2)}`);
    console.log(`   Value: $${positionValue.toFixed(2)}`);
    console.log(`   P/L: $${pnl.toFixed(2)} (${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`);
    console.log('');
    
    console.log('🎯 TRADING RECOMMENDATION:');
    console.log(`   Action: ${decision.action}`);
    console.log(`   Confidence: ${decision.confidence}%`);
    console.log(`   Risk Level: ${decision.riskLevel}`);
    console.log('');
    
    console.log('💡 REASONING:');
    decision.reasoning.forEach(reason => {
      console.log(`   • ${reason}`);
    });
    console.log('');
    
    // Specific recommendations
    console.log('📋 RECOMMENDED ACTIONS:');
    
    if (decision.action === 'TAKE_PARTIAL_PROFIT') {
      console.log('   ✅ Sell 25-50% of position now');
      console.log('   ✅ Set stop-loss at breakeven on remaining');
      console.log('   ✅ Hold 75-50% for 5% target');
      console.log('');
      console.log('   Command: node auto-take-profit.js 25');
    } else if (decision.action === 'TAKE_PROFIT') {
      console.log('   ✅ Sell entire position now');
      console.log('   ✅ Secure profits');
      console.log('   ✅ Free up capital for new trades');
      console.log('');
      console.log('   Command: node auto-take-profit.js 100');
    } else if (decision.action === 'REDUCE_POSITION') {
      console.log('   ⚠️  Reduce position size');
      console.log('   ⚠️  Cut losses early');
      console.log('   ⚠️  Preserve capital');
      console.log('');
      console.log('   Command: node auto-take-profit.js 50');
    } else if (decision.action === 'CUT_LOSS') {
      console.log('   ❌ Sell entire position');
      console.log('   ❌ Accept small loss');
      console.log('   ❌  Learn and try again');
      console.log('');
      console.log('   Command: node auto-take-profit.js 100');
    } else {
      console.log('   ⏳ Continue holding');
      console.log('   ⏳ Monitor market conditions');
      console.log('   ⏳ Wait for clearer signal');
      console.log('');
      console.log('   Command: node monitor-trading.js');
    }
    
    console.log('');
    console.log('🛡️ RISK MANAGEMENT:');
    console.log(`   Stop Loss: $${(entryPrice * 0.97).toFixed(2)} (-3%)`);
    console.log(`   Take Profit: $${(entryPrice * 1.05).toFixed(2)} (+5%)`);
    console.log(`   Breakeven: $${entryPrice.toFixed(2)}`);
    console.log('');
    
    console.log('=' .repeat(60));
    console.log('✅ DECISION ENGINE COMPLETE');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Decision engine failed:', error.message);
  }
}

console.log('🧠 AUTOMATED TRADING DECISION');
console.log('Using AI to analyze position and market...\n');

setTimeout(() => {
  tradingDecision().then(() => {
    console.log('\n💡 Run this periodically for trading guidance');
    console.log('💡 Use auto-take-profit.js for automated execution');
    process.exit(0);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}, 1000);