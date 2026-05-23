// Add KuCoin order validation to existing bot
const kucoinValidator = require('./kucoin-validator');

// ============================================================================
// INTEGRATE INTO YOUR EXISTING BOT CODE
// ============================================================================

// Add this to your bot's configuration
const CONFIG = {
  ...existingConfig,
  
  // KuCoin-specific requirements
  kucoinRequirements: {
    minOrderValue: 10,  // KuCoin minimum for most pairs
    enforceValidation: true,  // Always validate orders
    autoRoundOrders: true  // Automatically round to valid sizes
  }
};

// ============================================================================
// UPDATE YOUR ORDER PLACEMENT LOGIC
// ============================================================================

// BEFORE (problematic code):
async function placeOrder(pair, side, size, price) {
  const order = {
    symbol: pair,
    side: side,
    type: 'limit',
    size: size,  // ❌ No validation
    price: price  // ❌ No validation
  };
  
  return await makeRequest('POST', '/api/v1/orders', JSON.stringify(order));
}

// AFTER (with validation):
async function placeOrder(pair, side, size, price) {
  // 1. Validate order requirements
  const validation = kucoinValidator.validateKuCoinOrder(pair, size, price);
  if (!validation.valid) {
    throw new Error(`Invalid order: ${validation.error}`);
  }
  
  // 2. Get safe order size (rounds to valid increments)
  const safeOrder = kucoinValidator.getSafeOrderSize(pair, size, price, CONFIG.maxPositionSize);
  if (!safeOrder.valid) {
    throw new Error(`Cannot create valid order: ${safeOrder.error}`);
  }
  
  // 3. Round price to valid increment
  const roundedPrice = kucoinValidator.roundKuCoinOrderPrice(pair, price);
  
  // 4. Place validated order
  const order = {
    symbol: pair,
    side: side,
    type: 'limit',
    size: safeOrder.size,  // ✅ Validated and rounded
    price: roundedPrice   // ✅ Validated and rounded
  };
  
  console.log(`🤖 Placing order: ${pair} ${side} ${safeOrder.size} @ $${roundedPrice}`);
  return await makeRequest('POST', '/api/v1/orders', JSON.stringify(order));
}

// ============================================================================
// UPDATE POSITION CLOSING LOGIC
// ============================================================================

// BEFORE (problematic):
async function closePosition(position) {
  const order = {
    symbol: position.pair,
    side: 'sell',
    type: 'market',
    size: position.size  // ❌ May be too small
  };
  
  return await makeRequest('POST', '/api/v1/orders', JSON.stringify(order));
}

// AFTER (with validation):
async function closePosition(position) {
  // 1. Check if position can be closed via API
  const canClose = kucoinValidator.canClosePosition(position.pair, position.size, position.currentPrice);
  
  if (!canClose.canClose) {
    console.error(`❌ Cannot close position: ${canClose.reason}`);
    
    // Suggest manual intervention
    if (canClose.reason.includes('below KuCoin minimum')) {
      console.log('🚨 MANUAL INTERVENTION REQUIRED:');
      console.log('1. Log into KuCoin website');
      console.log('2. Go to Spot Trade → BTC-USDT');
      console.log('3. Find your position and close manually');
      console.log('4. The bot will resume trading after position is closed');
    }
    
    throw new Error(`Position cannot be closed: ${canClose.reason}`);
  }
  
  // 2. Get safe sell order size
  const safeOrder = kucoinValidator.getSafeOrderSize(
    position.pair, 
    position.size, 
    position.currentPrice, 
    position.positionSize  // Use full position value as max
  );
  
  // 3. Round price
  const roundedPrice = kucoinValidator.roundKuCoinOrderPrice(position.pair, position.currentPrice);
  
  // 4. Place validated sell order
  const order = {
    symbol: position.pair,
    side: 'sell',
    type: 'limit',
    size: safeOrder.size,
    price: roundedPrice,
    clientOid: `close-${position.id}`  // Track as close order
  };
  
  console.log(`🔄 Closing position: ${position.pair} ${safeOrder.size} @ $${roundedPrice}`);
  return await makeRequest('POST', '/api/v1/orders', JSON.stringify(order));
}

// ============================================================================
// UPDATE POSITION SIZE CALCULATION
// ============================================================================

// BEFORE (problematic):
function calculateOrderSize(pair, price, confidence) {
  const baseSize = CONFIG.maxPositionSize * confidence;
  return baseSize / price;  // ❌ No validation
}

// AFTER (with validation):
function calculateOrderSize(pair, price, confidence) {
  // 1. Calculate desired size based on confidence
  const desiredValue = CONFIG.maxPositionSize * confidence;
  let desiredSize = desiredValue / price;
  
  // 2. Get safe order size (meets all requirements)
  const safeOrder = kucoinValidator.getSafeOrderSize(
    pair, 
    desiredSize, 
    price, 
    CONFIG.maxPositionSize
  );
  
  // 3. If validation failed, try minimum size
  if (!safeOrder.valid) {
    console.warn(`⚠️  Desired size invalid for ${pair}, trying minimum`);
    const minSize = kucoinValidator.getMinimumOrderSize(pair, price);
    const minOrder = kucoinValidator.getSafeOrderSize(pair, minSize, price, CONFIG.maxPositionSize);
    
    if (!minOrder.valid) {
      throw new Error(`Cannot create valid order for ${pair}: ${minOrder.error}`);
    }
    
    console.log(`📉 Using minimum size: ${minOrder.size}`);
    return minOrder.size;
  }
  
  return safeOrder.size;
}

// ============================================================================
// UPDATE SIGNAL GENERATION TO CHECK MINIMUMS
// ============================================================================

// Add this to your signal generation logic:
async function generateTradingSignal(pair, currentPrice) {
  // Get minimum order requirements for this pair
  const minSize = kucoinValidator.getMinimumOrderSize(pair, currentPrice);
  const minValue = minSize * currentPrice;
  
  // Check if we have enough funds
  if (minValue > this.portfolio.usdt) {
    console.log(`⚠️  Insufficient USDT for ${pair}`);
    console.log(`   Required: $${minValue.toFixed(2)}`);
    console.log(`   Available: $${this.portfolio.usdt.toFixed(2)}`);
    return null;  // Skip this pair
  }
  
  // Check if max position size allows trading
  if (minValue > CONFIG.maxPositionSize) {
    console.log(`⚠️  Minimum order exceeds max position for ${pair}`);
    console.log(`   Minimum: $${minValue.toFixed(2)}`);
    console.log(`   Max allowed: $${CONFIG.maxPositionSize}`);
    return null;  // Skip this pair
  }
  
  // Check if we already have position in this pair
  if (this.openPositions.has(pair)) {
    console.log(`⏭️  Already have position in ${pair}, skipping`);
    return null;
  }
  
  // Generate signal with valid size constraints
  const signal = {
    pair: pair,
    action: 'buy',
    confidence: calculateConfidence(pair, currentPrice),
    minOrderSize: minSize,
    maxOrderSize: CONFIG.maxPositionSize / currentPrice
  };
  
  return signal;
}

// ============================================================================
// EXPORT FUNCTIONS FOR INTEGRATION
// ============================================================================

module.exports = {
  placeOrder,
  closePosition,
  calculateOrderSize,
  generateTradingSignal
};