#!/usr/bin/env node

/**
 * RESET BOT STATE AFTER MANUAL POSITION CLOSURE
 * This will reset the bot state to start fresh
 */

const fs = require('fs');
const path = require('path');

const stateFile = path.join(__dirname, 'bot-state.json');

console.log('🔄 Resetting bot state after position closure...\n');

try {
  // Read current state
  const currentState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  
  console.log('📋 Previous state:');
  console.log('   Open positions:', Object.keys(currentState.openPositions || {}).length);
  console.log('   Total trades:', currentState.totalTrades || 0);
  console.log('   Daily PnL:', (currentState.dailyPnL || 0).toFixed(2));
  
  // Reset state to clean slate
  const newState = {
    openPositions: {},        // No open positions
    totalTrades: currentState.totalTrades || 0,  // Keep trade history
    dailyPnL: currentState.dailyPnL || 0,       // Keep performance tracking
    lastTradeTime: null,
    tradingEnabled: true,
    lastPriceCheck: Date.now(),
    portfolio: {
      usdt: 3.72,             // Will be updated by bot
      totalValue: 9.74,       // Will be updated by bot
      assets: {}
    }
  };
  
  // Write new state
  fs.writeFileSync(stateFile, JSON.stringify(newState, null, 2));
  
  console.log('\n✅ Bot state reset successfully!');
  console.log('   Open positions cleared');
  console.log('   Portfolio will be recalculated on next start');
  console.log('   Trading history preserved');
  console.log('\n🚀 Bot is ready to start fresh with proper validation');
  
} catch (error) {
  console.error('❌ Error resetting bot state:', error.message);
}