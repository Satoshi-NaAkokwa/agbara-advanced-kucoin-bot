#!/bin/bash
# Quick Status Dashboard

echo "🤖 AGBARA KUCOIN BOT - LIVE STATUS"
echo "=================================="
echo ""

# PM2 Status
echo "📊 PM2 Processes:"
pm2 status | grep -A 4 "agbara-kucoin-bot\|bot-monitor" | grep -v "^--" | grep -v "online\|online.*disabled"
echo ""

# Portfolio Summary
echo "💰 Portfolio Summary:"
node -e "
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('bot-state.json', 'utf8'));
console.log(\`  Total: \$\${state.portfolio.totalValue.toFixed(2)}\`);
console.log(\`  USDT: \$\${state.portfolio.usdt.toFixed(2)} available\`);
Object.entries(state.portfolio.assets).forEach(([coin, amount]) => {
  if (parseFloat(amount) > 0) {
    console.log(\`  \${coin}: \${amount}\`);
  }
});
"
echo ""

# Market Conditions
echo "📈 Market Conditions:"
echo "  Sentiment: VERY_BEARISH"
echo "  Fear/Greed: 20 (Extreme Fear)"
echo "  Action: Conservative waiting"
echo ""

# Recent Activity
echo "🔄 Recent Bot Activity:"
pm2 logs agbara-kucoin-bot --lines 5 --nostream | grep "TRADING CYCLE\|Generated\|SESSION STATISTICS" | tail -5
echo ""

# System Health
echo "🏥 System Health:"
pm2 describe agbara-kucoin-bot | grep -E "restarts|uptime|memory" | head -3
echo ""

echo "⏰ Last Updated: $(date '+%Y-%m-%d %H:%M:%S')"