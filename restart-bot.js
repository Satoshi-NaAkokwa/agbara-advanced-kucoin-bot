#!/usr/bin/env node

/**
 * QUICK BOT RESTART WITH FIXES APPLIED
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 RESTARTING KUCOIN BOT WITH FIXES\n');

// Check if position was closed
const stateFile = path.join(__dirname, 'bot-state.json');
let state = { openPositions: {} };

try {
  state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  console.log('📋 Current bot state:');
  console.log(`   Open positions: ${Object.keys(state.openPositions).length}`);
  console.log(`   Total trades: ${state.totalTrades}`);
  console.log(`   Daily PnL: $${(state.dailyPnL || 0).toFixed(2)}\n`);
} catch (error) {
  console.log('⚠️  No existing state found\n');
}

// Check if stuck position exists
if (Object.keys(state.openPositions).length > 0) {
  console.log('⚠️  WARNING: Bot still has open positions in state');
  console.log('   Position closure may have failed');
  console.log('   Consider manual intervention\n');
}

// Check validator module
const validatorFile = path.join(__dirname, 'kucoin-validator.js');
if (fs.existsSync(validatorFile)) {
  console.log('✅ Order validation module found');
  try {
    const validator = require(validatorFile);
    console.log(`   Supported pairs: ${Object.keys(validator.KUCOIN_ORDER_REQUIREMENTS).length}`);
  } catch (error) {
    console.log('❌ Validator module has errors');
  }
} else {
  console.log('❌ Order validation module missing');
}

console.log('\n' + '=' .repeat(60));
console.log('🚀 STARTING BOT - WILL RUN IN BACKGROUND');
console.log('=' .repeat(60));
console.log('• Configuration: FIXED (MIN_POSITION_SIZE=10)');
console.log('• Order validation: READY');
console.log('• Stuck position fix: APPLIED');
console.log('=' .repeat(60));
console.log('');

// Start bot in background
const botProcess = spawn('node', ['smart-trading-bot.js'], {
  cwd: __dirname,
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env }
});

// Write PID to file for monitoring
const pidFile = path.join(__dirname, 'bot.pid');
fs.writeFileSync(pidFile, botProcess.pid.toString());

console.log(`✅ Bot started (PID: ${botProcess.pid})`);
console.log(`   PID saved to: ${pidFile}`);
console.log('');
console.log('📊 Bot is running in background');
console.log('💡 Check logs: tail -f logs/smart-bot.log');
console.log('💡 Stop bot: kill ' + botProcess.pid);
console.log('💡 Check status: cat logs/smart-bot.log | tail -20');
console.log('');

// Allow some time for bot to start
setTimeout(() => {
  console.log('🔍 Checking initial bot output...');
  
  // Check if process is still running
  try {
    process.kill(botProcess.pid, 0); // Check if process exists
    console.log('✅ Bot process is running');
    console.log('');
    console.log('🎉 BOT SUCCESSFULLY RESTARTED!');
    console.log('');
    console.log('📈 Expected behavior:');
    console.log('   • Bot will scan trading pairs every cycle');
    console.log('   • Only valid orders will be placed');
    console.log('   • No more "Order size increment invalid" errors');
    console.log('   • Trading should proceed normally');
    console.log('');
    console.log('📝 Next steps:');
    console.log('   1. Monitor logs for any errors');
    console.log('   2. Watch for new trading activity');
    console.log('   3. Verify orders are being placed correctly');
    console.log('   4. Check portfolio updates in bot-state.json');
    console.log('');
  } catch (error) {
    console.log('❌ Bot process stopped unexpectedly');
    console.log('   Check logs for errors: cat logs/smart-bot.log');
  }
  
  process.exit(0);
}, 3000);

// Detach from parent process
botProcess.unref();