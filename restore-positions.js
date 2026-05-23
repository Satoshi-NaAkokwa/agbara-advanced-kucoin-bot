#!/usr/bin/env node

/**
 * Restore Position Tracking
 * Recreates position tracking from exchange holdings
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'bot-state.json');

// Current holdings from exchange
const holdings = {
  BTC: { balance: 0.00007899, pair: 'BTC-USDT' },
  ETH: { balance: 0.0017109, pair: 'ETH-USDT' },
  KCS: { balance: 0.00631651, pair: 'KCS-USDT' },
  USDT: { balance: 0.00124614 }
};

// Reasonable entry points (you should update these with actual entry prices)
const entryEstimates = {
  BTC: 77548.00, // From old state
  ETH: 2132.04,  // From old state
  KCS: 12.50     // Estimate - update if needed
};

console.log('🔄 Restoring position tracking...\n');

// Load current state
let state = {};
try {
  if (fs.existsSync(STATE_FILE)) {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }
} catch (error) {
  console.log('Creating new state');
}

// Recreate positions for holdings
const restoredPositions = {};
let totalRestoredValue = 0;

Object.entries(holdings).forEach(([currency, data]) => {
  if (currency === 'USDT') return;
  
  if (data.balance > 0) {
    const entryPrice = entryEstimates[currency] || 10;
    const positionValue = data.balance * entryPrice;
    
    restoredPositions[`pos-${currency.toLowerCase()}-001`] = {
      id: `pos-${currency.toLowerCase()}-001`,
      pair: data.pair,
      strategy: 'restored',
      action: 'buy',
      entryPrice: entryPrice,
      size: data.balance,
      positionSize: positionValue,
      stopLoss: entryPrice * 0.97, // 3% stop loss
      takeProfit: entryPrice * 1.08, // 8% take profit
      trailingStop: null,
      confidence: 0.75,
      reasons: ['Position restored from exchange holdings'],
      timestamp: Date.now(),
      status: 'open'
    };
    
    totalRestoredValue += positionValue;
    console.log(`✅ Restored ${data.pair}: ${data.balance} @ $${entryPrice.toFixed(2)} ($${positionValue.toFixed(2)})`);
  }
});

// Update state
state.openPositions = restoredPositions;
state.portfolio = {
  usdt: holdings.USDT.balance,
  totalValue: totalRestoredValue + holdings.USDT.balance,
  assets: {
    BTC: holdings.BTC.balance,
    ETH: holdings.ETH.balance,
    KCS: holdings.KCS.balance,
    USDT: holdings.USDT.balance
  }
};

// Save state
fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
fs.writeFileSync(STATE_FILE + '.backup', JSON.stringify(state, null, 2));

console.log(`\n📊 Position Restoration Complete:`);
console.log(`   Total Positions: ${Object.keys(restoredPositions).length}`);
console.log(`   Total Value: $${state.portfolio.totalValue.toFixed(2)}`);
console.log(`   State Saved: ${STATE_FILE}`);
console.log(`   Backup Created: ${STATE_FILE}.backup`);

console.log('\n⚠️  IMPORTANT:');
console.log('   • Entry prices are estimated - verify manually');
console.log('   • Stop loss: 3% below entry');
console.log('   • Take profit: 8% above entry');
console.log('   • Bot will now manage these positions for optimal exits');