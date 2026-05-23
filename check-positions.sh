#!/bin/bash
# Quick Position Check Script

echo "🤖 Agbara KuCoin Bot - Position Status"
echo "========================================"
echo ""

# Check actual holdings
node sync-positions.js

echo ""
echo "📊 Bot State:"
node -e "
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('bot-state.json', 'utf8'));
const positions = Object.values(state.openPositions);
if (positions.length === 0) {
  console.log('  Bot tracking: No positions');
} else {
  console.log(\`  Bot tracking: \${positions.length} positions\`);
  positions.forEach(pos => {
    console.log(\`    • \${pos.pair}: Entry \$\${pos.entryPrice}, Target \$\${pos.takeProfit.toFixed(2)}, Stop \$\${pos.stopLoss.toFixed(2)}\`);
  });
}
console.log(\`  Portfolio: \$\${state.portfolio.totalValue.toFixed(2)}\`);
"

echo ""
echo "📈 Expected Performance:"
node -e "
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('bot-state.json', 'utf8'));
Object.values(state.openPositions).forEach(pos => {
  const profit = pos.takeProfit - pos.entryPrice;
  const profitPct = ((pos.takeProfit / pos.entryPrice) - 1) * 100;
  const currentValue = pos.size * pos.entryPrice;
  const targetValue = pos.size * pos.takeProfit;
  console.log(\`  \${pos.pair}: \$\${currentValue.toFixed(2)} → \$\${targetValue.toFixed(2)} (+\$\${profit.toFixed(2)}, +\${profitPct.toFixed(0)}%)\`);
});
"

echo ""
echo "⚠️  If holdings don't match bot tracking, run:"
echo "   node restore-positions.js"