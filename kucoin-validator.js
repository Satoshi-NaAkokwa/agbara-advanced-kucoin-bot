#!/usr/bin/env node

/**
 * UPDATED KUCOIN ORDER VALIDATION WITH CORRECT API DATA
 * Uses actual KuCoin API requirements
 */

// KuCoin Order Requirements by Trading Pair (UPDATED FROM ACTUAL API)
const KUCOIN_ORDER_REQUIREMENTS = {
  'BTC-USDT': {
    minFunds: 0.1,           // KuCoin API: minFunds: "0.1" (not 10!)
    sizeIncrement: 0.00000001, // KuCoin API: baseIncrement: "0.00000001"
    priceIncrement: 0.1     // KuCoin API: priceIncrement: "0.1"
  },
  'ETH-USDT': {
    minFunds: 0.1,
    sizeIncrement: 0.00001,
    priceIncrement: 0.01
  },
  'SOL-USDT': {
    minFunds: 0.1,
    sizeIncrement: 0.0001,
    priceIncrement: 0.0001
  },
  'USDT-USDC': {
    minFunds: 0.1,
    sizeIncrement: 1,
    priceIncrement: 0.0001
  },
  'DOGE-USDT': {
    minFunds: 0.1,
    sizeIncrement: 1,
    priceIncrement: 0.00001
  },
  'PEPE-USDT': {
    minFunds: 0.1,
    sizeIncrement: 100,
    priceIncrement: 0.00000001
  },
  'WIF-USDT': {
    minFunds: 0.1,
    sizeIncrement: 0.1,
    priceIncrement: 0.0001
  },
  'BONK-USDT': {
    minFunds: 0.1,
    sizeIncrement: 1000,
    priceIncrement: 0.0000001
  },
  // Default requirements for unknown pairs
  'default': {
    minFunds: 0.1,
    sizeIncrement: 0.00000001,
    priceIncrement: 0.1
  }
};

/**
 * Validate order parameters against KuCoin requirements
 * @param {string} pair - Trading pair (e.g., 'BTC-USDT')
 * @param {number} size - Order size in base asset
 * @param {number} price - Order price in quote asset
 * @returns {object} Validation result {valid: boolean, error: string}
 */
function validateKuCoinOrder(pair, size, price) {
  const reqs = KUCOIN_ORDER_REQUIREMENTS[pair] || KUCOIN_ORDER_REQUIREMENTS['default'];
  
  if (!KUCOIN_ORDER_REQUIREMENTS[pair]) {
    console.warn(`⚠️  Unknown pair ${pair}, using default requirements`);
  }
  
  const orderValue = size * price;
  if (orderValue < reqs.minFunds) {
    return {
      valid: false,
      error: `Order value ($${orderValue.toFixed(2)}) below minimum ($${reqs.minFunds}). ` +
             `Required: ${(reqs.minFunds / price).toFixed(8)} ${pair.split('-')[0]} minimum`
    };
  }
  
  const sizeQuotient = size / reqs.sizeIncrement;
  const isMultiple = Math.abs(sizeQuotient - Math.floor(sizeQuotient)) < 0.000001;
  
  if (!isMultiple) {
    return {
      valid: false,
      error: `Size (${size}) must be multiple of ${reqs.sizeIncrement}. ` +
             `Valid sizes: ${reqs.sizeIncrement}, ${reqs.sizeIncrement * 2}, ${reqs.sizeIncrement * 3}...`
    };
  }
  
  const priceQuotient = price / reqs.priceIncrement;
  const isPriceMultiple = Math.abs(priceQuotient - Math.floor(priceQuotient)) < 0.000001;
  
  if (!isPriceMultiple) {
    return {
      valid: false,
      error: `Price (${price}) must be multiple of ${reqs.priceIncrement}`
    };
  }
  
  return { valid: true };
}

/**
 * Round order size to meet KuCoin increment requirements
 * @param {string} pair - Trading pair
 * @param {number} size - Original size
 * @returns {number} Properly rounded size
 */
function roundKuCoinOrderSize(pair, size) {
  const reqs = KUCOIN_ORDER_REQUIREMENTS[pair] || KUCOIN_ORDER_REQUIREMENTS['default'];
  return Math.floor(size / reqs.sizeIncrement) * reqs.sizeIncrement;
}

/**
 * Round order price to meet KuCoin increment requirements  
 * @param {string} pair - Trading pair
 * @param {number} price - Original price
 * @returns {number} Properly rounded price
 */
function roundKuCoinOrderPrice(pair, price) {
  const reqs = KUCOIN_ORDER_REQUIREMENTS[pair] || KUCOIN_ORDER_REQUIREMENTS['default'];
  return Math.floor(price / reqs.priceIncrement) * reqs.priceIncrement;
}

/**
 * Calculate minimum order size for a given pair and price
 * @param {string} pair - Trading pair
 * @param {number} price - Current price
 * @returns {number} Minimum valid order size
 */
function getMinimumOrderSize(pair, price) {
  const reqs = KUCOIN_ORDER_REQUIREMENTS[pair] || KUCOIN_ORDER_REQUIREMENTS['default'];
  const minSize = reqs.minFunds / price;
  const roundedSize = Math.ceil(minSize / reqs.sizeIncrement) * reqs.sizeIncrement;
  return roundedSize;
}

/**
 * Check if position can be closed via API
 * @param {string} pair - Trading pair
 * @param {number} size - Position size
 * @param {number} price - Current price
 * @returns {object} {canClose: boolean, reason: string}
 */
function canClosePosition(pair, size, price) {
  const reqs = KUCOIN_ORDER_REQUIREMENTS[pair] || KUCOIN_ORDER_REQUIREMENTS['default'];
  const positionValue = size * price;
  
  if (positionValue < reqs.minFunds) {
    return {
      canClose: false,
      reason: `Position value ($${positionValue.toFixed(2)}) below KuCoin minimum ($${reqs.minFunds}). ` +
              `Manual intervention required.`
    };
  }
  
  const validation = validateKuCoinOrder(pair, size, price);
  if (!validation.valid) {
    return {
      canClose: false,
      reason: validation.error
    };
  }
  
  return { canClose: true };
}

/**
 * Get safe order size that meets all requirements
 * @param {string} pair - Trading pair
 * @param {number} desiredSize - Desired order size
 * @param {number} price - Current price
 * @param {number} maxPositionSize - Maximum position size in USDT
 * @returns {object} {size: number, valid: boolean, error: string}
 */
function getSafeOrderSize(pair, desiredSize, price, maxPositionSize = 100) {
  const minSize = getMinimumOrderSize(pair, price);
  let safeSize = Math.max(desiredSize, minSize);
  
  safeSize = roundKuCoinOrderSize(pair, safeSize);
  
  const maxSizeValue = safeSize * price;
  if (maxSizeValue > maxPositionSize) {
    safeSize = Math.floor((maxPositionSize / price) / minSize) * minSize;
  }
  
  const validation = validateKuCoinOrder(pair, safeSize, price);
  
  return {
    size: safeSize,
    valid: validation.valid,
    error: validation.error
  };
}

module.exports = {
  validateKuCoinOrder,
  roundKuCoinOrderSize,
  roundKuCoinOrderPrice,
  getMinimumOrderSize,
  canClosePosition,
  getSafeOrderSize,
  KUCOIN_ORDER_REQUIREMENTS
};

console.log('✅ KuCoin order validation loaded with corrected API data');
console.log('   BTC-USDT minimum: $0.1 (not $10)');