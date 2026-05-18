/**
 * Combined Risk Management from both bots
 * Advanced position sizing, stop-loss, and portfolio protection
 */

const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/risk-manager.log' })
  ]
});

class AdvancedRiskManager {
  constructor(config = {}) {
    this.maxPositionSize = config.maxPositionSize || parseFloat(process.env.MAX_POSITION_SIZE) || 1000;
    this.riskPerTrade = config.riskPerTrade || parseFloat(process.env.RISK_PER_TRADE) || 0.02;
    this.maxDailyLoss = config.maxDailyLoss || parseFloat(process.env.MAX_DAILY_LOSS) || 500;
    this.stopLossPct = config.stopLossPct || parseFloat(process.env.STOP_LOSS_PCT) || 0.02;
    this.takeProfitPct = config.takeProfitPct || parseFloat(process.env.TAKE_PROFIT_PCT) || 0.05;
    this.maxTradesPerPair = config.maxTradesPerPair || parseInt(process.env.MAX_TRADES_PER_PAIR) || 3;
    this.maxDailyTrades = config.maxDailyTrades || parseInt(process.env.MAX_DAILY_TRADES) || 50;
    
    this.dailyLoss = 0;
    this.dailyTrades = 0;
    this.pairTradeCount = {};
    this.positions = new Map();
  }

  resetDailyCounters() {
    this.dailyLoss = 0;
    this.dailyTrades = 0;
    this.pairTradeCount = {};
    logger.info('Daily risk counters reset');
  }

  calculatePositionSize(accountBalance, riskAmount, confidence) {
    const riskAdjustedSize = Math.min(
      this.maxPositionSize,
      (accountBalance * this.riskPerTrade) / riskAmount
    );
    
    const confidenceAdjustedSize = riskAdjustedSize * confidence;
    return Math.floor(confidenceAdjustedSize * 100) / 100;
  }

  async evaluateTrade(trade) {
    const riskChecks = {
      dailyLossLimit: this.checkDailyLoss(),
      dailyTradeLimit: this.checkDailyTrades(),
      pairTradeLimit: this.checkPairTradeLimit(trade.symbol),
      positionSize: this.validatePositionSize(trade),
      riskReward: this.validateRiskReward(trade)
    };

    const allPassed = Object.values(riskChecks).every(check => check.passed);
    
    if (!allPassed) {
      const failures = Object.entries(riskChecks)
        .filter(([_, check]) => !check.passed)
        .map(([name, check]) => `${name}: ${check.reason}`);
      
      logger.warn(`Trade rejected: ${failures.join(', ')}`);
      return { passed: false, reasons: failures };
    }

    return { passed: true, positionSize: riskChecks.positionSize.size };
  }

  checkDailyLoss() {
    if (this.dailyLoss >= this.maxDailyLoss) {
      return { passed: false, reason: `Daily loss limit reached: $${this.dailyLoss}` };
    }
    return { passed: true };
  }

  checkDailyTrades() {
    if (this.dailyTrades >= this.maxDailyTrades) {
      return { passed: false, reason: `Daily trade limit reached: ${this.dailyTrades}` };
    }
    return { passed: true };
  }

  checkPairTradeLimit(symbol) {
    const count = this.pairTradeCount[symbol] || 0;
    if (count >= this.maxTradesPerPair) {
      return { passed: false, reason: `Pair trade limit reached for ${symbol}: ${count}` };
    }
    return { passed: true };
  }

  validatePositionSize(trade) {
    if (trade.size > this.maxPositionSize) {
      return { passed: false, size: 0, reason: `Position size exceeds limit: ${trade.size} > ${this.maxPositionSize}` };
    }
    return { passed: true, size: trade.size };
  }

  validateRiskReward(trade) {
    if (trade.stopLoss && trade.takeProfit) {
      const riskReward = (trade.takeProfit - trade.entry) / Math.abs(trade.entry - trade.stopLoss);
      if (riskReward < 1.5) {
        return { passed: false, reason: `Risk-reward ratio too low: ${riskReward.toFixed(2)}` };
      }
    }
    return { passed: true };
  }

  recordTrade(trade) {
    this.dailyTrades++;
    this.pairTradeCount[trade.symbol] = (this.pairTradeCount[trade.symbol] || 0) + 1;
    this.positions.set(trade.id, {
      ...trade,
      entryTime: Date.now(),
      stopLoss: trade.entry * (1 - this.stopLossPct),
      takeProfit: trade.entry * (1 + this.takeProfitPct)
    });
    
    logger.info(`Trade recorded: ${trade.symbol} ${trade.side} ${trade.size} @ ${trade.entry}`);
  }

  async checkExitConditions(position, currentPrice) {
    if (currentPrice <= position.stopLoss) {
      return { shouldExit: true, reason: 'STOP_LOSS', price: position.stopLoss };
    }
    if (currentPrice >= position.takeProfit) {
      return { shouldExit: true, reason: 'TAKE_PROFIT', price: position.takeProfit };
    }
    return { shouldExit: false };
  }

  recordExit(position, exitPrice, reason) {
    const pnl = (exitPrice - position.entry) * position.size * (position.side === 'buy' ? 1 : -1);
    this.dailyLoss += pnl < 0 ? Math.abs(pnl) : 0;
    this.positions.delete(position.id);
    
    logger.info(`Position closed: ${position.symbol} PnL: $${pnl.toFixed(2)} (${reason})`);
    return { pnl, reason };
  }

  getPortfolioSummary() {
    return {
      dailyLoss: this.dailyLoss,
      dailyTrades: this.dailyTrades,
      activePositions: this.positions.size,
      pairTradeCount: this.pairTradeCount,
      maxDailyLoss: this.maxDailyLoss,
      remainingTrades: this.maxDailyTrades - this.dailyTrades
    };
  }
}

module.exports = AdvancedRiskManager;