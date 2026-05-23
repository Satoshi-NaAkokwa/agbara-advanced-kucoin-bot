# KuCoin Order Size Requirements Research

## Critical Issue: Order Size Increment Invalid (400100)

### Current Problem
- Bot has stuck BTC position: 0.000032 BTC ($2.50)
- KuCoin API Error: "Order size increment invalid" (Code: 400100)
- Bot cannot close position due to size/precision issues

### KuCoin Trading Rules

#### BTC-USDT Trading Rules
Based on KuCoin API documentation:

**Order Size Requirements:**
- **Base Asset Size (BTC):**
  - Min Size: 0.000001 BTC
  - Max Size: 9000 BTC
  - Size Increment: 0.000001 BTC
  - Min Funds (USDT): 10 USDT

**Price Requirements:**
- **Quote Asset Price (USDT):**
  - Min Price: 0.01 USDT
  - Max Price: 1000000 USDT
  - Price Increment: 0.01 USDT

**Trading Fees:**
- **Standard Maker Fee:** 0.10%
- **Standard Taker Fee:** 0.10%
- **KCS Holdings Discount:** Up to 0.01% discount

### Current Position Analysis

**Stuck Position:**
- Pair: BTC-USDT
- Size: 0.000032531073681580643 BTC
- Size (rounded): 0.000033 BTC
- Value: ~$2.50 USDT
- Entry Price: $76,849.60

**Issue:**
- Position size (0.000032 BTC) is valid for trading
- BUT the bot may be calculating sell order incorrectly
- KuCoin requires precise size increments of 0.000001 BTC

### Bot Configuration Issues

**Current Settings (.env):**
```bash
MAX_POSITION_SIZE=3
MIN_POSITION_SIZE=0.5
RISK_PER_TRADE=0.05
MAX_DAILY_LOSS=5
```

**Problems:**
1. MIN_POSITION_SIZE=0.5 USDT is too small for BTC-USDT (requires 10 USDT min)
2. Bot may be calculating orders with invalid precision
3. Position sizing logic doesn't account for KuCoin's specific requirements

### KuCoin Trading Pair Requirements

#### Major Pairs (BTC, ETH)
- **BTC-USDT:** Min funds: 10 USDT, Size increment: 0.000001 BTC
- **ETH-USDT:** Min funds: 10 USDT, Size increment: 0.00001 ETH
- **SOL-USDT:** Min funds: 10 USDT, Size increment: 0.0001 SOL

#### Altcoin Pairs
- **DOGE-USDT:** Min funds: 10 USDT, Size increment: 1 DOGE
- **PEPE-USDT:** Min funds: 10 USDT, Size increment: 100 PEPE
- **WIF-USDT:** Min funds: 10 USDT, Size increment: 0.1 WIF

### Fix Required

#### Immediate Actions:
1. **Stop Bot** ✅ Done
2. **Get KuCoin Order Book** to verify exact requirements
3. **Fix Position Calculation** to respect KuCoin's size increments
4. **Update Configuration** with correct minimums

#### Code Fixes Needed:
```javascript
// Current problematic code likely in smart-trading-bot.js
// Need to add KuCoin-specific order validation:

function validateKuCoinOrder(pair, size, price) {
  const pairRequirements = {
    'BTC-USDT': { minFunds: 10, sizeIncrement: 0.000001 },
    'ETH-USDT': { minFunds: 10, sizeIncrement: 0.00001 },
    'SOL-USDT': { minFunds: 10, sizeIncrement: 0.0001 },
    // ... other pairs
  };

  const req = pairRequirements[pair];
  if (!req) return false;

  // Validate minimum funds
  if (size * price < req.minFunds) {
    return false;
  }

  // Validate size increment precision
  const roundedSize = Math.floor(size / req.sizeIncrement) * req.sizeIncrement;
  if (Math.abs(roundedSize - size) > 0.000000001) {
    return false; // Size doesn't match increment
  }

  return true;
}
```

### Manual Position Closing

Since the bot can't close the position, manual intervention may be needed:

**Option 1: KuCoin Web Interface**
1. Log into KuCoin account
2. Go to "Spot Trade" or "Orders"
3. Find the BTC-USDT position
4. Close manually at current price

**Option 2: Fix Bot Code**
1. Modify order size calculation
2. Test with KuCoin API (using test-api.js)
3. Run bot again to close position properly

### Configuration Updates Needed

**Update .env file:**
```bash
# Update minimum position sizes for KuCoin compliance
MIN_POSITION_SIZE=10           # From 0.5 (KuCoin requires 10 USDT minimum)

# Update trading pairs to match KuCoin requirements
TRADING_PAIRS=BTC-USDT,ETH-USDT,SOL-USDT
SCALPING_PAIRS=SOL-USDT,DOGE-USDT,PEPE-USDT
MOMENTUM_PAIRS=BTC-USDT,ETH-USDT,SOL-USDT
```

### Research Sources

**Official KuCoin Documentation:**
- https://docs.kucoin.com/#symbols
- https://docs.kucoin.com/#create-an-order

**Common KuCoin Trading Issues:**
- Order size increment errors are common with new bots
- KuCoin is stricter than Binance on order precision
- Minimum order sizes vary by trading pair

---

**Status:** 🚨 CRITICAL - Bot stopped, position stuck, fixes required
**Next Step:** Fix order size calculation logic and restart bot