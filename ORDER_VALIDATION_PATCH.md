/**
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
    console.warn(`⚠️  Order size invalid for ${pair}: ${safeOrder.error}`);
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
  console.error(`❌ Order validation failed: ${validation.error}`);
  continue;  // Skip this trade
}

console.log(`✅ Order validated: ${pair} ${side} ${size} @ $${roundedPrice}`);

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
  console.error(`❌ Cannot close position: ${canClose.reason}`);
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
  clientOid: `close-${position.id}`
};
