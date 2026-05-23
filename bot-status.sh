#!/bin/bash
# 24/7 Bot Management Script

SCRIPT_DIR="/home/openclaw/.openclaw/workspace/agbara-advanced-kucoin-bot"
cd "$SCRIPT_DIR"

echo "🤖 Agbara KuCoin Bot 24/7 Management System"
echo "=========================================="

# Check PM2 status
echo ""
echo "📊 PM2 Process Status:"
pm2 status

echo ""
echo "📈 Bot Health Check:"
pm2 describe agbara-kucoin-bot | grep -E "status|uptime|restarts|memory"

echo ""
echo "📝 Recent Logs (last 20 lines):"
pm2 logs agbara-kucoin-bot --lines 20 --nostream

echo ""
echo "💰 Current Positions:"
node -e "
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('bot-state.json', 'utf8'));
const positions = Object.values(state.openPositions);
if (positions.length === 0) {
  console.log('  No open positions');
} else {
  positions.forEach(pos => {
    const profit = pos.partialProfitTaken ? \`$\${pos.totalProfitSecured.toFixed(2)} secured\` : 'Open';
    console.log(\`  • \${pos.pair}: Entry $\${pos.entryPrice}, Size \${pos.size.toFixed(6)}, \${profit}\`);
  });
}
console.log(\`Portfolio: $\${state.portfolio.totalValue.toFixed(2)} total, $\${state.portfolio.usdt.toFixed(2)} USDT available\`);
"