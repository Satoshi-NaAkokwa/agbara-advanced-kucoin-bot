// Updated KuCoin Order Requirements (from actual API data)
const KUCOIN_ORDER_REQUIREMENTS = {
  'BTC-USDT': {
    minFunds: 0.1,           // Updated: KuCoin API shows minFunds: "0.1"
    sizeIncrement: 0.00000001, // Updated: API shows baseIncrement: "0.00000001"
    priceIncrement: 0.1     // Updated: API shows priceIncrement: "0.1"
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
  'default': {
    minFunds: 0.1,           // Updated to actual KuCoin minimum
    sizeIncrement: 0.00000001, // Updated to match BTC precision
    priceIncrement: 0.1
  }
};

console.log('✅ KuCoin order requirements updated with actual API data');
console.log('BTC-USDT minimum funds: $0.1 (not $10 as initially assumed)');