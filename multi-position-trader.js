#!/usr/bin/env node

/**
 * MULTI-POSITION TRADER
 * Open multiple positions with available capital
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

async function multiPositionTrader() {
  console.log('🎯 MULTI-POSITION TRADER\n');
  console.log('Analyzing opportunities for multiple positions...\n');
  console.log('=' .repeat(60));
  
  try {
    // Get account balances
    const accounts = await makeRequest('GET', '/api/v1/accounts');
    const usdtAccount = accounts.find(a => a.currency === 'USDT' && a.type === 'trade');
    const ethAccount = accounts.find(a => a.currency === 'ETH' && a.type === 'trade');
    
    const usdtAvailable = parseFloat(usdtAccount?.available || 0);
    const ethAvailable = parseFloat(ethAccount?.available || 0);
    
    console.log('💰 AVAILABLE CAPITAL:');
    console.log(`   USDT: $${usdtAvailable.toFixed(4)}`);
    console.log(`   ETH: ${ethAvailable.toFixed(6)} (in position)`);
    console.log('');
    
    if (usdtAvailable < 0.1) {
      console.log('❌ INSUFFICIENT USDT for new positions');
      console.log('   Wait for current position to close');
      console.log('   Or add more funds to account');
      return;
    }
    
    // Analyze multiple trading pairs
    const pairs = ['ETH-USDT', 'BTC-USDT', 'SOL-USDT'];
    const opportunities = [];
    
    for (const pair of pairs) {
      try {
        const ticker = await makeRequest('GET', `/api/v1/market/orderbook/level1?symbol=${pair}`);
        const stats = await makeRequest('GET', `/api/v1/market/stats?symbol=${pair}`);
        
        const currentPrice = parseFloat(ticker.price);
        const change24h = parseFloat(stats.changeRate) * 100;
        const vol24h = parseFloat(stats.vol) * currentPrice / 1000000;
        const high24h = parseFloat(stats.high);
        const low24h = parseFloat(stats.low);
        
        // Calculate position size (33% of available capital per position)
        const positionSize = usdtAvailable * 0.33; // 33% per position = 3 positions max
        const cryptoSize = positionSize / currentPrice;
        
        // Get symbol info for validation
        const symbols = await makeRequest('GET', '/api/v2/symbols');
        const symbol = symbols.find(s => s.symbol === pair);
        const baseIncrement = parseFloat(symbol.baseIncrement);
        const priceIncrement = parseFloat(symbol.priceIncrement);
        const minFunds = parseFloat(symbol.minFunds);
        
        // Validate position
        const isValid = positionSize >= minFunds && cryptoSize >= baseIncrement;
        
        // Calculate risk/reward
        const inUpperHalf = currentPrice > ((high24h + low24h) / 2);
        const nearLow = (currentPrice / low24h) < 1.05;
        const favorableEntry = nearLow || change24h < -1;
        
        opportunities.push({
          pair,
          currentPrice,
          change24h,
          vol24h,
          positionSize,
          cryptoSize,
          isValid,
          favorableEntry,
          inUpperHalf,
          riskScore: favorableEntry ? 'LOW' : inUpperHalf ? 'HIGH' : 'MEDIUM',
          recommendation: isValid ? (favorableEntry ? 'BUY' : 'WAIT') : 'INVALID'
        });
        
      } catch (error) {
        console.log(`⚠️  Could not analyze ${pair}: ${error.message}`);
      }
    }
    
    console.log('📊 MARKET OPPORTUNITIES:');
    console.log('');
    
    let validOpportunities = 0;
    
    opportunities.forEach(opp => {
      const emoji = opp.recommendation === 'BUY' ? '✅' : opp.recommendation === 'WAIT' ? '⏳' : '❌';
      console.log(`${emoji} ${opp.pair}:`);
      console.log(`   Price: $${opp.currentPrice.toFixed(2)}`);
      console.log(`   24h Change: ${opp.change24h > 0 ? '+' : ''}${opp.change24h.toFixed(2)}%`);
      console.log(`   Volume: $${opp.vol24h.toFixed(2)}M`);
      console.log(`   Position Size: $${opp.positionSize.toFixed(2)}`);
      console.log(`   Risk Score: ${opp.riskScore}`);
      console.log(`   Recommendation: ${opp.recommendation}`);
      console.log('');
      
      if (opp.recommendation === 'BUY') validOpportunities++;
    });
    
    console.log('=' .repeat(60));
    
    if (validOpportunities === 0) {
      console.log('💡 CURRENT SITUATION:');
      console.log('   No favorable entry points detected');
      console.log('   Market conditions suggest waiting');
      console.log('   Current ETH position is performing well');
      console.log('');
      console.log('📋 RECOMMENDED ACTIONS:');
      console.log('   1. Continue monitoring current ETH position');
      console.log('   2. Wait for better entry points on other pairs');
      console.log('   3. Consider taking more profits on current position');
      console.log('   4. Preserve capital for upcoming opportunities');
    } else {
      console.log(`🎯 TRADING OPPORTUNITIES: ${validOpportunities} favorable entry points`);
      console.log('');
      console.log('📋 RECOMMENDED ACTIONS:');
      console.log('   1. Open positions on BUY recommendations');
      console.log('   2. Diversify across multiple pairs');
      console.log('   3. Maintain 33% capital per position');
      console.log('   4. Set automated profit-taking on new positions');
    }
    
    console.log('');
    console.log('💡 CAPITAL ALLOCATION PLAN:');
    console.log(`   Available: $${usdtAvailable.toFixed(2)}`);
    console.log(`   Per Position: $${(usdtAvailable * 0.33).toFixed(2)} (33%)`);
    console.log(`   Max Positions: 3`);
    console.log(`   Reserve: $${(usdtAvailable * 0.34).toFixed(2)} (34%)`);
    console.log('');
    
    console.log('=' .repeat(60));
    console.log('✅ MULTI-POSITION ANALYSIS COMPLETE');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Multi-position trader failed:', error.message);
  }
}

console.log('🎯 MULTI-POSITION TRADER');
console.log('Analyzing multiple trading opportunities...\n');

setTimeout(() => {
  multiPositionTrader().then(() => {
    console.log('\n💡 Run this periodically to identify trading opportunities');
    console.log('💡 Use corrected-simple-bot.js for single positions');
    process.exit(0);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}, 1000);