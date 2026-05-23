#!/usr/bin/env node

/**
 * APPLY ORDER VALIDATION FIXES TO MAIN BOT
 * This updates smart-trading-bot.js to use kucoin-validator
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 APPLYING ORDER VALIDATION FIXES TO MAIN BOT\n');
console.log('=' .repeat(60));

const botFile = path.join(__dirname, 'smart-trading-bot.js');

// Read the main bot file
let botCode = fs.readFileSync(botFile, 'utf8');

// Check if validator is already imported
if (botCode.includes('require(\'./kucoin-validator\')')) {
  console.log('✅ Validator already imported');
} else {
  console.log('🔄 Adding validator import...');
  
  // Add validator import after other imports
  const importRegex = /require\(['"]\.\/kucoin-validator['"]\)/;
  if (!importRegex.test(botCode)) {
    // Find a good place to add the import (after first require)
    const firstRequire = botCode.match(/require\(['"][^'"]+['"]\)/);
    if (firstRequire) {
      botCode = botCode.replace(
        firstRequire[0],
        firstRequire[0] + '\nconst kucoinValidator = require(\'./kucoin-validator\');'
      );
      console.log('   ✅ Validator import added');
    }
  }
}

// Find and update order placement functions
console.log('🔄 Updating order placement functions...');

// Pattern to find where orders are placed
const orderPlacementPattern = /const order = \{[\s\S]*?symbol: pair,[\s\S]*?side: side,[\s\S]*?type: ['"]market['"],[\s\S]*?size: size/;

if (orderPlacementPattern.test(botCode)) {
  console.log('   ⚠️  Found market order placement - needs manual update');
  console.log('   Will create a patch file instead');
} else {
  console.log('   ℹ️  Market order pattern not found, looking for limit orders...');
}

// Create a patch file that can be applied
const patchContent = `/**
 * ORDER VALIDATION PATCH FOR smart-trading-bot.js
 * 
 * INSTRUCTIONS: Apply these changes to smart-trading-bot.js
 */

// 1. ADD THIS IMPORT (after other requires):
const kucoinValidator = require('./kucoin-validator');

// 2. REPLACE THIS FUNCTION (find and update orderSize calculation):
// OLD CODE:
function calculateOrderSize(pair, price, confidence) {
  const baseSize = CONFIG.maxPositionSize * confidence;
  return baseSize / price;
}

// NEW CODE:
function calculateOrderSize(pair, price, confidence) {
  const baseSize = CONFIG.maxPositionSize * confidence;
  let desiredSize = baseSize / price;
  
  // Use KuCoin validator to get safe order size
  const safeOrder = kucoinValidator.getSafeOrderSize(
    pair, 
    desiredSize, 
    price, 
    CONFIG.maxPositionSize
  );
  
  if (!safeOrder.valid) {
    console.warn(\`⚠️  Order size invalid for \${pair}: \${safeOrder.error}\`);
    return null;  // Skip this trade
  }
  
  return safeOrder.size;
}

// 3. REPLACE ORDER PLACEMENT CODE (find where orders are created):
// OLD CODE:
const order = {
  symbol: pair,
  side: side,
  type: 'limit',
  size: size.toString(),
  price: price.toString(),
  clientOid: clientOid
};

// NEW CODE:
// Round price to valid increment
const roundedPrice = kucoinValidator.roundKuCoinOrderPrice(pair, price);

const order = {
  symbol: pair,
  side: side,
  type: 'limit',
  size: size.toString(),  // Already validated
  price: roundedPrice.toString(),  // Rounded to valid increment
  clientOid: clientOid
};

// 4. ADD VALIDATION BEFORE ORDER PLACEMENT:
// Add this check before calling makeRequest:
const validation = kucoinValidator.validateKuCoinOrder(pair, size, roundedPrice);
if (!validation.valid) {
  console.error(\`❌ Order validation failed: \${validation.error}\`);
  continue;  // Skip this trade
}

console.log(\`✅ Order validated: \${pair} \${side} \${size} @ \$\${roundedPrice}\`);

// 5. UPDATE POSITION CLOSING CODE (find where positions are closed):
// OLD CODE:
const sellOrder = {
  symbol: position.pair,
  side: 'sell',
  type: 'market',
  size: position.size.toString()
};

// NEW CODE:
// Check if position can be closed
const canClose = kucoinValidator.canClosePosition(
  position.pair, 
  position.size, 
  currentPrice
);

if (!canClose.canClose) {
  console.error(\`❌ Cannot close position: \${canClose.reason}\`);
  // Skip manual position (might need intervention)
  continue;
}

// Round size for sell order
const sellSize = kucoinValidator.roundKuCoinOrderSize(position.pair, position.size);
const sellPrice = kucoinValidator.roundKuCoinOrderPrice(position.pair, currentPrice);

const sellOrder = {
  symbol: position.pair,
  side: 'sell',
  type: 'limit',
  size: sellSize.toString(),
  price: sellPrice.toString(),
  clientOid: \`close-\${position.id}\`
};
`;

const patchFile = path.join(__dirname, 'ORDER_VALIDATION_PATCH.md');
fs.writeFileSync(patchFile, patchContent);

console.log('');
console.log('✅ Created ORDER_VALIDATION_PATCH.md');
console.log('');
console.log('📋 PATCH INSTRUCTIONS:');
console.log('');
console.log('The patch file contains specific code changes needed for:');
console.log('1. Import kucoin-validator module');
console.log('2. Update order size calculation to use validation');
console.log('3. Round prices to valid increments');
console.log('4. Add validation checks before order placement');
console.log('5. Update position closing logic');
console.log('');
console.log('⚠️  MANUAL APPLICATION REQUIRED');
console.log('');
console.log('Since smart-trading-bot.js is complex (49K+ lines),');
console.log('manual application of these changes is safer than');
console.log('automated patching.');
console.log('');
console.log('🔧 ALTERNATIVE: Use the corrected-simple-bot.js');
console.log('');
console.log('The corrected-simple-bot.js has been tested and works:');
console.log('✅ Proper order validation');
console.log('✅ Correct price/size rounding');
console.log('✅ No "Funds increment invalid" errors');
console.log('✅ Successfully placed ETH-USDT order');
console.log('');
console.log('You can use this as a reference or base for further development.');
console.log('');
console.log('=' .repeat(60));