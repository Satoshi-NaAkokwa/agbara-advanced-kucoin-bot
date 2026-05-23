#!/usr/bin/env node

/**
 * START MONITORING YOUR ACTIVE TRADING
 * Run this to keep track of your positions and orders
 */

const { spawn } = require('child_process');

console.log('🚀 STARTING CONTINUOUS TRADING MONITOR\n');
console.log('=' .repeat(60));
console.log('This will monitor your KuCoin trading activity every 30 seconds');
console.log('Press Ctrl+C to stop monitoring\n');
console.log('=' .repeat(60));
console.log('');

// Run the monitoring script repeatedly
const monitorInterval = 30000; // 30 seconds

function runMonitor() {
  const monitor = spawn('node', ['monitor-trading.js'], {
    cwd: __dirname,
    stdio: 'inherit'
  });
  
  monitor.on('close', (code) => {
    console.log('\n⏰ Waiting 30 seconds for next update...');
    setTimeout(() => {
      console.log('\n' + '=' .repeat(60));
      runMonitor();
    }, monitorInterval);
  });
}

runMonitor();