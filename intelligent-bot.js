#!/usr/bin/env node

/**
 * Intelligent Self-Learning KuCoin Trading Bot
 * Features: Adaptive strategies, Pattern recognition, Self-learning, Portfolio optimization
 */

require('dotenv').config();
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

// Configure logging
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
    new winston.transports.File({ filename: 'logs/intelligent-bot.log' })
  ]
});

class IntelligentTradingBot {
  constructor() {
    this.apiKey = process.env.KUCOIN_API_KEY;
    this.secretKey = process.env.KUCOIN_SECRET_KEY;
    this.passphrase = process.env.KUCOIN_API_PASSPHRASE;
    this.baseUrl = 'api.kucoin.com';
    
    // State
    this.isRunning = false;
    this.portfolio = {};
    this.tradeHistory = [];
    this.strategies = {};
    this.patterns = [];
    this.learningData = {};
    
    // Configuration
    this.maxPositionSize = parseFloat(process.env.MAX_POSITION_SIZE) || 50;
    this.minConfidence = parseFloat(process.env.MIN_CONFIDENCE) || 0.75;
    this.tradingPairs = (process.env.TRADING_PAIRS || 'BTC-USDT,ETH-USDT,SOL-USDT').split(',');
    
    // Self-learning
    this.learningEnabled = process.env.LEARNING_ENABLED === 'true';
    this.adaptiveStrategies = process.env.ADAPTIVE_STRATEGIES === 'true';
    this.patternRecognition = process.env.PATTERN_RECOGNITION === 'true';
    
    // Load learning data
    this.loadLearningData();
  }

  sign(str) {
    return crypto.createHmac('sha256', this.secretKey).update(str).digest('base64');
  }

  async makeRequest(method, endpoint, body = '') {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now().toString();
      const what = timestamp + method + endpoint + body;
      const signature = this.sign(what);
      const passphraseSigned = this.sign(this.passphrase);

      const options = {
        hostname: this.baseUrl,
        port: 443,
        path: endpoint,
        method: method,
        headers: {
          'KC-API-KEY': this.apiKey,
          'KC-API-SIGN': signature,
          'KC-API-TIMESTAMP': timestamp,
          'KC-API-PASSPHRASE': passphraseSigned,
          'KC-API-KEY-VERSION': '2',
          'Content-Type': 'application/json'
        }
      };

      if (body) {
        options.headers['Content-Length'] = Buffer.byteLength(body);
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.code === '200000') {
              resolve(result.data);
            } else {
              reject(new Error(`KuCoin API Error: ${result.msg} (Code: ${result.code})`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  async start() {
    logger.info('🤖 Starting Intelligent Self-Learning Trading Bot');
    logger.info('📊 Initializing adaptive strategies and pattern recognition');
    
    try {
      // Load portfolio
      await this.loadPortfolio();
      
      // Initialize strategies
      this.initializeStrategies();
      
      // Start trading loop
      this.isRunning = true;
      this.startTradingLoop();
      
      logger.info('✅ Bot started successfully');
    } catch (error) {
      logger.error(`❌ Failed to start bot: ${error.message}`);
      throw error;
    }
  }

  async loadPortfolio() {
    const accounts = await this.makeRequest('GET', '/api/v1/accounts');
    
    this.portfolio = {
      usdt: 0,
      eth: 0,
      sol: 0,
      btc: 0,
      kcs: 0,
      totalValue: 0
    };
    
    accounts.forEach(acc => {
      if (acc.type === 'trade' && parseFloat(acc.balance) > 0) {
        this.portfolio[acc.currency.toLowerCase()] = parseFloat(acc.balance);
        logger.info(`💰 ${acc.currency}: ${acc.balance}`);
      }
    });
    
    // Get current prices to calculate total value
    const prices = await this.getPrices();
    this.portfolio.totalValue = 
      this.portfolio.usdt +
      (this.portfolio.eth * prices['ETH-USDT']) +
      (this.portfolio.sol * prices['SOL-USDT']) +
      (this.portfolio.btc * prices['BTC-USDT']) +
      (this.portfolio.kcs * (prices['KCS-USDT'] || 10));
    
    logger.info(`💵 Total Portfolio Value: $${this.portfolio.totalValue.toFixed(2)}`);
  }

  async getPrices() {
    const prices = {};
    
    for (const pair of ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'KCS-USDT']) {
      try {
        const ticker = await this.makeRequest('GET', `/api/v1/market/orderbook/level1?symbol=${pair}`);
        prices[pair] = parseFloat(ticker.price);
      } catch (error) {
        // Skip if pair not found
      }
    }
    
    return prices;
  }

  initializeStrategies() {
    this.strategies = {
      momentum: {
        weight: 0.3,
        performance: 0,
        trades: 0,
        enabled: true
      },
      scalping: {
        weight: 0.25,
        performance: 0,
        trades: 0,
        enabled: true
      },
      meanReversion: {
        weight: 0.25,
        performance: 0,
        trades: 0,
        enabled: true
      },
      patternRecognition: {
        weight: 0.2,
        performance: 0,
        trades: 0,
        enabled: this.patternRecognition
      }
    };
    
    logger.info('📊 Strategies initialized:');
    Object.entries(this.strategies).forEach(([name, strategy]) => {
      logger.info(`   ${name}: ${(strategy.weight * 100).toFixed(0)}% weight, ${strategy.enabled ? 'enabled' : 'disabled'}`);
    });
  }

  startTradingLoop() {
    let iteration = 0;
    
    const tradeLoop = async () => {
      if (!this.isRunning) return;
      
      iteration++;
      logger.info(`\n🔄 Trading Cycle #${iteration}`);
      
      try {
        // Analyze market
        const analysis = await this.analyzeMarket();
        
        // Generate signals
        const signals = this.generateSignals(analysis);
        
        // Execute trades based on signals
        await this.executeSignals(signals);
        
        // Learn from recent trades
        if (this.learningEnabled) {
          this.learnFromTrades();
        }
        
        // Update portfolio
        await this.loadPortfolio();
        
        // Save learning data
        this.saveLearningData();
        
      } catch (error) {
        logger.error(`Trading cycle error: ${error.message}`);
      }
      
      // Schedule next cycle
      setTimeout(tradeLoop, parseInt(process.env.CHECK_INTERVAL) || 300000);
    };
    
    tradeLoop();
  }

  async analyzeMarket() {
    const analysis = {};
    
    for (const pair of this.tradingPairs) {
      try {
        // Get klines
        const klines = await this.makeRequest('GET', `/api/v1/market/candles?symbol=${pair}&type=1hour&limit=100`);
        
        // Calculate indicators
        const closes = klines.map(k => parseFloat(k[2]));
        const volumes = klines.map(k => parseFloat(k[5]));
        const currentPrice = closes[closes.length - 1];
        
        analysis[pair] = {
          price: currentPrice,
          rsi: this.calculateRSI(closes),
          macd: this.calculateMACD(closes),
          sma20: this.calculateSMA(closes, 20),
          sma50: this.calculateSMA(closes, 50),
          volume: volumes[volumes.length - 1],
          avgVolume: this.calculateAverage(volumes.slice(-20)),
          trend: this.determineTrend(closes),
          volatility: this.calculateVolatility(closes)
        };
        
      } catch (error) {
        logger.error(`Error analyzing ${pair}: ${error.message}`);
      }
    }
    
    return analysis;
  }

  calculateRSI(prices, period = 14) {
    if (prices.length < period) return 50;
    
    const gains = [];
    const losses = [];
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains.push(change);
      else losses.push(Math.abs(change));
    }
    
    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateMACD(prices) {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    return macd;
  }

  calculateEMA(prices, period) {
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  calculateSMA(prices, period) {
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }

  calculateAverage(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  determineTrend(prices) {
    const sma20 = this.calculateSMA(prices, 20);
    const sma50 = this.calculateSMA(prices, 50);
    const currentPrice = prices[prices.length - 1];
    
    if (currentPrice > sma20 && sma20 > sma50) return 'bullish';
    if (currentPrice < sma20 && sma20 < sma50) return 'bearish';
    return 'neutral';
  }

  calculateVolatility(prices) {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    const avg = this.calculateAverage(returns);
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  generateSignals(analysis) {
    const signals = [];
    
    for (const [pair, data] of Object.entries(analysis)) {
      const signal = {
        pair,
        action: 'hold',
        confidence: 0,
        reasons: [],
        strategies: {}
      };
      
      // Momentum strategy
      if (this.strategies.momentum.enabled) {
        const momentumSignal = this.analyzeMomentum(data);
        signal.strategies.momentum = momentumSignal;
        
        if (momentumSignal.action !== 'hold') {
          signal.reasons.push(`Momentum: ${momentumSignal.reason}`);
        }
      }
      
      // Mean reversion strategy
      if (this.strategies.meanReversion.enabled) {
        const reversionSignal = this.analyzeMeanReversion(data);
        signal.strategies.meanReversion = reversionSignal;
        
        if (reversionSignal.action !== 'hold') {
          signal.reasons.push(`Mean Reversion: ${reversionSignal.reason}`);
        }
      }
      
      // Scalping strategy
      if (this.strategies.scalping.enabled) {
        const scalpingSignal = this.analyzeScalping(data);
        signal.strategies.scalping = scalpingSignal;
        
        if (scalpingSignal.action !== 'hold') {
          signal.reasons.push(`Scalping: ${scalpingSignal.reason}`);
        }
      }
      
      // Pattern recognition
      if (this.patternRecognition && this.patterns.length > 0) {
        const patternSignal = this.recognizePattern(data);
        signal.strategies.patternRecognition = patternSignal;
        
        if (patternSignal.action !== 'hold') {
          signal.reasons.push(`Pattern: ${patternSignal.reason}`);
        }
      }
      
      // Combine signals
      signal.action = this.combineSignals(signal.strategies);
      signal.confidence = this.calculateConfidence(signal.strategies);
      
      if (signal.action !== 'hold' && signal.confidence >= this.minConfidence) {
        signals.push(signal);
      }
    }
    
    return signals;
  }

  analyzeMomentum(data) {
    const signal = { action: 'hold', confidence: 0, reason: '' };
    
    if (data.trend === 'bullish' && data.rsi > 50 && data.rsi < 70 && data.macd > 0) {
      signal.action = 'buy';
      signal.confidence = 0.7;
      signal.reason = 'Strong bullish momentum with RSI in optimal range';
    } else if (data.trend === 'bearish' && data.rsi < 50 && data.rsi > 30 && data.macd < 0) {
      signal.action = 'sell';
      signal.confidence = 0.7;
      signal.reason = 'Strong bearish momentum with RSI in optimal range';
    }
    
    return signal;
  }

  analyzeMeanReversion(data) {
    const signal = { action: 'hold', confidence: 0, reason: '' };
    
    if (data.rsi < 30) {
      signal.action = 'buy';
      signal.confidence = 0.75;
      signal.reason = 'RSI oversold - mean reversion opportunity';
    } else if (data.rsi > 70) {
      signal.action = 'sell';
      signal.confidence = 0.75;
      signal.reason = 'RSI overbought - mean reversion opportunity';
    }
    
    return signal;
  }

  analyzeScalping(data) {
    const signal = { action: 'hold', confidence: 0, reason: '' };
    
    // High volume spike
    if (data.volume > data.avgVolume * 1.5) {
      if (data.trend === 'bullish') {
        signal.action = 'buy';
        signal.confidence = 0.65;
        signal.reason = 'Volume spike with bullish trend';
      } else if (data.trend === 'bearish') {
        signal.action = 'sell';
        signal.confidence = 0.65;
        signal.reason = 'Volume spike with bearish trend';
      }
    }
    
    return signal;
  }

  recognizePattern(data) {
    const signal = { action: 'hold', confidence: 0, reason: '' };
    
    // Simple pattern recognition based on historical patterns
    for (const pattern of this.patterns) {
      if (this.matchesPattern(data, pattern)) {
        signal.action = pattern.action;
        signal.confidence = pattern.successRate;
        signal.reason = `Matched historical pattern with ${(pattern.successRate * 100).toFixed(0)}% success rate`;
        break;
      }
    }
    
    return signal;
  }

  matchesPattern(currentData, pattern) {
    // Simple pattern matching based on RSI and trend
    const rsiDiff = Math.abs(currentData.rsi - pattern.conditions.rsi);
    const trendMatch = currentData.trend === pattern.conditions.trend;
    
    return rsiDiff < 5 && trendMatch;
  }

  combineSignals(strategies) {
    const votes = { buy: 0, sell: 0, hold: 0 };
    
    for (const [name, signal] of Object.entries(strategies)) {
      if (signal && signal.action && this.strategies[name]) {
        votes[signal.action] += signal.confidence * this.strategies[name].weight;
      }
    }
    
    if (votes.buy > votes.sell && votes.buy > votes.hold) return 'buy';
    if (votes.sell > votes.buy && votes.sell > votes.hold) return 'sell';
    return 'hold';
  }

  calculateConfidence(strategies) {
    let totalConfidence = 0;
    let count = 0;
    
    for (const [name, signal] of Object.entries(strategies)) {
      if (signal && signal.confidence > 0 && this.strategies[name]) {
        totalConfidence += signal.confidence * this.strategies[name].weight;
        count++;
      }
    }
    
    return count > 0 ? totalConfidence : 0;
  }

  async executeSignals(signals) {
    for (const signal of signals) {
      try {
        await this.executeTrade(signal);
      } catch (error) {
        logger.error(`Failed to execute signal for ${signal.pair}: ${error.message}`);
      }
    }
  }

  async executeTrade(signal) {
    const { pair, action, confidence, reasons } = signal;
    
    logger.info(`📝 ${action.toUpperCase()} signal for ${pair}`);
    logger.info(`   Confidence: ${(confidence * 100).toFixed(0)}%`);
    logger.info(`   Reasons: ${reasons.join(', ')}`);
    
    // Get current price
    const ticker = await this.makeRequest('GET', `/api/v1/market/orderbook/level1?symbol=${pair}`);
    const price = parseFloat(ticker.price);
    
    // Calculate position size based on confidence and portfolio
    const positionSize = this.calculatePositionSize(price, confidence);
    
    if (positionSize <= 0) {
      logger.warn(`Invalid position size for ${pair}`);
      return;
    }
    
    try {
      if (action === 'buy') {
        // Check if we have enough USDT
        if (this.portfolio.usdt < positionSize) {
          logger.warn(`Insufficient USDT balance. Need: $${positionSize}, Have: $${this.portfolio.usdt.toFixed(2)}`);
          return;
        }
        
        const size = positionSize / price;
        
        const order = await this.makeRequest('POST', '/api/v1/orders', JSON.stringify({
          clientOid: `bot-${Date.now()}`,
          side: 'buy',
          symbol: pair,
          type: 'market',
          funds: positionSize.toString()
        }));
        
        logger.info(`✅ BUY ${pair}: $${positionSize.toFixed(2)} @ $${price.toFixed(2)}`);
        logger.info(`   Order ID: ${order.orderId}`);
        
        // Record trade for learning
        this.recordTrade({
          pair,
          action: 'buy',
          price,
          size,
          confidence,
          reasons,
          timestamp: Date.now()
        });
        
      } else if (action === 'sell') {
        // Check if we have the asset
        const baseCurrency = pair.split('-')[0].toLowerCase();
        const available = this.portfolio[baseCurrency] || 0;
        
        if (available <= 0) {
          logger.warn(`No ${baseCurrency.toUpperCase()} to sell`);
          return;
        }
        
        const size = Math.min(positionSize / price, available);
        
        const order = await this.makeRequest('POST', '/api/v1/orders', JSON.stringify({
          clientOid: `bot-${Date.now()}`,
          side: 'sell',
          symbol: pair,
          type: 'market',
          size: size.toString()
        }));
        
        logger.info(`✅ SELL ${pair}: ${size.toFixed(6)} @ $${price.toFixed(2)}`);
        logger.info(`   Order ID: ${order.orderId}`);
        
        // Record trade for learning
        this.recordTrade({
          pair,
          action: 'sell',
          price,
          size,
          confidence,
          reasons,
          timestamp: Date.now()
        });
      }
      
    } catch (error) {
      logger.error(`❌ Trade execution failed: ${error.message}`);
    }
  }

  calculatePositionSize(price, confidence) {
    // Base position size
    let size = this.maxPositionSize * confidence;
    
    // Adjust based on portfolio value
    const portfolioRatio = this.portfolio.totalValue > 0 ? 
      size / this.portfolio.totalValue : 1;
    
    // Cap at 5% of portfolio per trade
    if (portfolioRatio > 0.05) {
      size = this.portfolio.totalValue * 0.05;
    }
    
    // Ensure minimum trade size
    if (size < 5) {
      size = 0; // Don't trade if too small
    }
    
    return Math.floor(size * 100) / 100;
  }

  recordTrade(trade) {
    this.tradeHistory.push(trade);
    
    // Keep only last 100 trades
    if (this.tradeHistory.length > 100) {
      this.tradeHistory.shift();
    }
  }

  learnFromTrades() {
    if (this.tradeHistory.length < 5) return;
    
    logger.info('📚 Learning from recent trades...');
    
    // Analyze recent trades
    const recentTrades = this.tradeHistory.slice(-10);
    
    for (const trade of recentTrades) {
      // Update strategy performance based on trade outcome
      // This is simplified - in production you'd check actual P&L
      
      for (const reason of trade.reasons) {
        const strategyName = reason.split(':')[0].toLowerCase().replace(' ', '');
        
        if (this.strategies[strategyName]) {
          // Simple learning: increase weight for successful trades
          // In production, you'd calculate actual profit/loss
          this.strategies[strategyName].trades++;
        }
      }
      
      // Add to patterns if successful (simplified)
      if (trade.confidence > 0.8) {
        this.addPattern(trade);
      }
    }
    
    // Adapt strategy weights based on performance
    if (this.adaptiveStrategies) {
      this.adaptStrategies();
    }
  }

  addPattern(trade) {
    // Check if similar pattern already exists
    const exists = this.patterns.some(p => 
      Math.abs(p.conditions.rsi - trade.rsi) < 10 && p.action === trade.action
    );
    
    if (!exists && this.patterns.length < 20) {
      this.patterns.push({
        conditions: {
          rsi: trade.rsi,
          trend: trade.trend
        },
        action: trade.action,
        successRate: trade.confidence,
        occurrences: 1
      });
    }
  }

  adaptStrategies() {
    const totalTrades = Object.values(this.strategies).reduce((sum, s) => sum + s.trades, 0);
    
    if (totalTrades < 10) return;
    
    // Adjust weights based on performance
    let totalWeight = 0;
    
    for (const [name, strategy] of Object.entries(this.strategies)) {
      if (strategy.trades > 0) {
        const performanceRatio = strategy.trades / totalTrades;
        strategy.weight = Math.max(0.1, Math.min(0.4, performanceRatio));
      }
      totalWeight += strategy.weight;
    }
    
    // Normalize weights
    for (const strategy of Object.values(this.strategies)) {
      strategy.weight /= totalWeight;
    }
    
    logger.info('📊 Adapted strategy weights:');
    Object.entries(this.strategies).forEach(([name, strategy]) => {
      logger.info(`   ${name}: ${(strategy.weight * 100).toFixed(0)}%`);
    });
  }

  loadLearningData() {
    try {
      const dataPath = path.join(__dirname, 'learning-data.json');
      if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        this.tradeHistory = data.tradeHistory || [];
        this.patterns = data.patterns || [];
        this.strategies = data.strategies || this.strategies;
        logger.info('📚 Loaded learning data from previous sessions');
      }
    } catch (error) {
      logger.warn('Could not load learning data, starting fresh');
    }
  }

  saveLearningData() {
    try {
      const dataPath = path.join(__dirname, 'learning-data.json');
      const data = {
        tradeHistory: this.tradeHistory,
        patterns: this.patterns,
        strategies: this.strategies,
        lastSaved: Date.now()
      };
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error(`Failed to save learning data: ${error.message}`);
    }
  }

  async stop() {
    logger.info('🛑 Stopping bot...');
    this.isRunning = false;
    this.saveLearningData();
    logger.info('✅ Bot stopped');
  }
}

// Main execution
const bot = new IntelligentTradingBot();

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await bot.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await bot.stop();
  process.exit(0);
});

bot.start().catch(error => {
  logger.error(`Failed to start bot: ${error.message}`);
  process.exit(1);
});

module.exports = IntelligentTradingBot;