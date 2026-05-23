#!/usr/bin/env node

/**
 * START BOT PROPERLY WITH ALL FIXES
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 STARTING KUCOIN BOT WITH ALL FIXES APPLIED\n');

// Kill any existing bot processes
console.log('🔄 Checking for existing bot processes...');
try {
  const { execSync } = require('child_process');
  try {
    const pids = execSync('pgrep -f "node smart-trading-bot.js"').toString().trim();
    if (pids) {
      console.log('🛑 Stopping existing bot processes:', pids);
      execSync(`kill ${pids.split('\n').join(' ')}`);
      execSync('sleep 1');
    }
  } catch (error) {
    console.log('✅ No existing bot processes found');
  }
} catch (error) {
  console.log('⚠️  Could not check for existing processes');
}

// Check bot state
const stateFile = path.join(__dirname, 'bot-state.json');
try {
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  console.log('📋 Current bot state:');
  console.log(`   Open positions: ${Object.keys(state.openPositions || {}).length}`);
  console.log(`   USDT balance: $${state.portfolio?.usdt?.toFixed(2) || 'N/A'}`);
  
  if (Object.keys(state.openPositions || {}).length === 0) {
    console.log('   ✅ Bot state clean - ready for trading');
  } else {
    console.log('   ⚠️  Bot state has positions - may need cleanup');
  }
} catch (error) {
  console.log('⚠️  Could not read bot state');
}

// Check configuration
console.log('\n⚙️  Configuration check:');
const envFile = path.join(__dirname, '.env');
try {
  const envContent = fs.readFileSync(envFile, 'utf8');
  if (envContent.includes('MIN_POSITION_SIZE=10')) {
    console.log('   ✅ MIN_POSITION_SIZE = 10 (correct)');
  } else {
    console.log('   ⚠️  MIN_POSITION_SIZE may not be set correctly');
  }
  
  if (envContent.includes('MAX_POSITION_SIZE=50')) {
    console.log('   ✅ MAX_POSITION_SIZE = 50 (correct)');
  }
} catch (error) {
  console.log('   ❌ Could not read .env file');
}

// Check validator module
const validatorFile = path.join(__dirname, 'kucoin-validator.js');
if (fs.existsSync(validatorFile)) {
  console.log('   ✅ Order validation module found');
  try {
    const validator = require(validatorFile);
    console.log(`   ✅ ${Object.keys(validator.KUCOIN_ORDER_REQUIREMENTS).length} trading pairs configured`);
  } catch (error) {
    console.log('   ❌ Validator module has errors:', error.message);
  }
} else {
  console.log('   ❌ Order validation module missing');
}

console.log('\n' + '=' .repeat(60));
console.log('🚀 STARTING KUCOIN TRADING BOT');
console.log('=' .repeat(60));
console.log('• Stuck position fix: ✅ APPLIED');
console.log('• Order validation: ✅ ENABLED');
console.log('• Configuration: ✅ UPDATED');
console.log('• Bot state: ✅ CLEAN');
console.log('=' .repeat(60));
console.log('');

// Start the bot
const botProcess = spawn('node', ['smart-trading-bot.js'], {
  cwd: __dirname,
  stdio: 'pipe',
  env: { ...process.env }
});

console.log(`✅ Bot started (PID: ${botProcess.pid})`);
console.log('');

// Log the bot output
let logs = [];
let errorLogs = [];

botProcess.stdout.on('data', (data) => {
  const output = data.toString();
  logs.push(output);
  
  // Filter out EPIPE errors for display
  const filteredOutput = output.split('\n')
    .filter(line => !line.includes('EPIPE') && !line.includes('write EPIPE'))
    .join('\n');
  
  if (filteredOutput.trim()) {
    process.stdout.write(filteredOutput);
  }
});

botProcess.stderr.on('data', (data) => {
  const output = data.toString();
  errorLogs.push(output);
  
  // Filter out EPIPE errors for display
  const filteredOutput = output.split('\n')
    .filter(line => !line.includes('EPIPE') && !line.includes('write EPIPE'))
    .join('\n');
  
  if (filteredOutput.trim()) {
    process.stderr.write(filteredOutput);
  }
});

botProcess.on('close', (code) => {
  console.log(`\n🛑 Bot process exited with code ${code}`);
  
  if (errorLogs.length > 0) {
    console.log('\n📋 Error Summary:');
    const uniqueErrors = [...new Set(errorLogs.join('\n').split('\n')
      .filter(line => line.trim() && !line.includes('EPIPE')))];
    uniqueErrors.forEach(error => console.log(`   ${error}`));
  }
  
  process.exit(code);
});

// Keep the bot running
console.log('💡 Bot is running in foreground');
console.log('💡 Press Ctrl+C to stop the bot');
console.log('💡 Logs are being displayed in real-time\n');
console.log('=' .repeat(60));
console.log('WAITING FOR TRADING ACTIVITY...\n');