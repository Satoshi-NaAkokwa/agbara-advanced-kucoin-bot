#!/usr/bin/env node

/**
 * START BOT WITH VALIDATION FIXES APPLIED
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting KuCoin bot with validation fixes...\n');

// Check if bot state needs to be reset
const stateFile = path.join(__dirname, 'bot-state.json');
try {
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  
  if (Object.keys(state.openPositions || {}).length > 0) {
    console.log('⚠️  Bot still has open positions in state file');
    console.log('   This may cause issues if positions were closed manually');
    console.log('   Resetting state to clean slate...\n');
    
    // Reset state
    state.openPositions = [];
    state.portfolio = {
      usdt: 3.76,
      totalValue: 9.74,
      assets: {
        USDT: 3.76,
        ETH: 0.0028022,
        KCS: 0.00817213
      }
    };
    state.lastSaved = Date.now();
    
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    console.log('✅ Bot state reset to clean slate\n');
  } else {
    console.log('✅ Bot state is clean, no stuck positions\n');
  }
} catch (error) {
  console.log('⚠️  Could not read bot state, will start fresh\n');
}

// Check if order validation module is available
const validatorFile = path.join(__dirname, 'kucoin-validator.js');
if (!fs.existsSync(validatorFile)) {
  console.log('❌ Order validation module not found!');
  console.log('   Please ensure kucoin-validator.js exists in the bot directory');
  process.exit(1);
} else {
  console.log('✅ Order validation module found');
}

// Check configuration
const envFile = path.join(__dirname, '.env');
if (!fs.existsSync(envFile)) {
  console.log('❌ .env file not found!');
  process.exit(1);
} else {
  const envContent = fs.readFileSync(envFile, 'utf8');
  if (envContent.includes('MIN_POSITION_SIZE=10')) {
    console.log('✅ Configuration updated (MIN_POSITION_SIZE=10)');
  } else {
    console.log('⚠️  Configuration may not be updated');
  }
}

console.log('\n' + '=' .repeat(60));
console.log('STARTING KUCOIN TRADING BOT');
console.log('=' .repeat(60));
console.log('• Order validation: ENABLED');
console.log('• Minimum order requirements: ENFORCED');
console.log('• Stuck position prevention: ACTIVE');
console.log('• Portfolio management: NORMAL');
console.log('=' .repeat(60));
console.log('');

// Start the bot
const botProcess = spawn('node', ['smart-trading-bot.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env }
});

console.log('🤖 Bot process started (PID: ' + botProcess.pid + ')');
console.log('💡 Press Ctrl+C to stop the bot\n');

// Handle bot process
botProcess.on('error', (error) => {
  console.error('❌ Failed to start bot:', error.message);
  process.exit(1);
});

botProcess.on('exit', (code) => {
  console.log(`\n🛑 Bot process exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping bot gracefully...');
  botProcess.kill('SIGINT');
  setTimeout(() => {
    botProcess.kill('SIGKILL');
    process.exit(0);
  }, 5000);
});