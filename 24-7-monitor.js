#!/usr/bin/env node

/**
 * 24/7 MONITORING SCRIPT
 * Ensures bot stays running and monitors positions for optimal profit-taking
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'bot-state.json');
const LOG_FILE = path.join(__dirname, 'logs', 'monitor.log');

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${message}`);
  fs.appendFileSync(LOG_FILE, `${timestamp} ${message}\n`);
}

async function checkBotStatus() {
  return new Promise((resolve) => {
    exec('pm2 describe agbara-kucoin-bot', (error, stdout) => {
      if (error || stdout.includes('not found')) {
        resolve({ running: false });
      } else {
        const online = stdout.includes('status') && stdout.includes('online');
        resolve({ running: online, details: stdout });
      }
    });
  });
}

async function restartBot() {
  return new Promise((resolve) => {
    log('🔄 Restarting bot...');
    exec('pm2 restart agbara-kucoin-bot --update-env', (error, stdout) => {
      if (error) {
        log(`❌ Failed to restart bot: ${error.message}`);
        resolve(false);
      } else {
        log('✅ Bot restarted successfully');
        resolve(true);
      }
    });
  });
}

async function checkPositions() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return null;
    }

    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const positions = Object.values(state.openPositions || {});

    log(`📊 Current positions: ${positions.length}`);

    if (positions.length > 0) {
      positions.forEach(pos => {
        const currentProfit = pos.partialProfitTaken ?
          `$${pos.totalProfitSecured.toFixed(2)} secured` :
          'Open position';

        log(`  • ${pos.pair}: Entry $${pos.entryPrice}, ${currentProfit}`);
      });
    }

    return state;
  } catch (error) {
    log(`❌ Error checking positions: ${error.message}`);
    return null;
  }
}

async function main() {
  log('🚀 Starting 24/7 monitoring...');

  while (true) {
    try {
      // Check if bot is running
      const status = await checkBotStatus();

      if (!status.running) {
        log('⚠️  Bot is not running! Restarting...');
        await restartBot();
      } else {
        log('✅ Bot is running normally');
      }

      // Check positions
      await checkPositions();

      // Wait 5 minutes before next check
      await new Promise(resolve => setTimeout(resolve, 300000));

    } catch (error) {
      log(`❌ Monitoring error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  }
}

// Start monitoring
main();