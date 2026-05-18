#!/usr/bin/env node

/**
 * Agbara Advanced KuCoin Trading Bot
 * Merged from kucoin-profit-bot and agbara-kucoin-trading-bot
 * Local LLM integration for intelligent 24/7 autonomous trading
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const winston = require('winston');

// Import merged components
const KuCoinConnector = require('./core/kucoin-connector');
const LocalLLMClient = require('./llm-client');
const AdvancedRiskManager = require('./risk-manager');
const TechnicalAnalysis = require('./technical-analysis');
const StrategyEngine = require('./strategy-engine');

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
    new winston.transports.File({ filename: 'logs/bot.log' })
  ]
});

class AgbaraAdvancedKuCoinBot {
  constructor() {
    this.validateConfig();
    this.initializeComponents();
    this.setupDailyReset();
  }

  validateConfig() {
    const required = [
      'KUCOIN_API_KEY',
      'KUCOIN_SECRET_KEY', 
      'KUCOIN_API_PASSPHRASE',
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_CHAT_ID'
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    logger.info('Configuration validated successfully');
  }

  initializeComponents() {
    // Initialize KuCoin API connection
    this.kucoin = new KuCoinConnector({
      apiKey: process.env.KUCOIN_API_KEY,
      secretKey: process.env.KUCOIN_SECRET_KEY,
      passphrase: process.env.KUCOIN_API_PASSPHRASE,
      sandbox: process.env.NODE_ENV !== 'production'
    });

    // Initialize LLM client
    this.llm = new LocalLLMClient({
      endpoint: process.env.LLM_ENDPOINT,
      model: process.env.LLM_MODEL,
      timeout: parseInt(process.env.LLM_TIMEOUT) || 30000,
      enabled: true
    });

    // Initialize risk manager
    this.riskManager = new AdvancedRiskManager({
      maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE) || 1000,
      riskPerTrade: parseFloat(process.env.RISK_PER_TRADE) || 0.02,
      maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS) || 500
    });

    // Initialize technical analysis
    this.technicalAnalysis = new TechnicalAnalysis();

    // Initialize strategy engine
    this.strategyEngine = new StrategyEngine({
      minConfidence: parseFloat(process.env.MIN_CONFIDENCE) || 0.7,
      strategies: ['scalping', 'momentum', 'arbitrage', 'moonshot']
    });

    // Trading state
    this.isRunning = false;
    this.positions = new Map();
    this.lastTradeTime = 0;
    this.tradeCooldown = parseInt(process.env.CHECK_INTERVAL) || 60000;

    logger.info('All components initialized successfully');
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Bot is already running');
      return;
    }

    try {
      logger.info('🚀 Starting Agbara Advanced KuCoin Trading Bot...');
      
      // Test connections
      await this.testConnections();
      
      // Start 24/7 monitoring
      this.startMonitoring();
      
      // Setup scheduled tasks
      this.setupScheduledTasks();
      
      this.isRunning = true;
      logger.info('✅ Bot started successfully and running 24/7');
      
      this.sendTelegramNotification('🚀 Agbara Advanced KuCoin Bot started successfully! 24/7 trading active.');
      
    } catch (error) {
      logger.error(`Failed to start bot: ${error.message}`);
      throw error;
    }
  }

  async testConnections() {
    logger.info('Testing connections...');
    
    // Test KuCoin API
    try {
      const accounts = await this.kucoin.getAccounts();
      logger.info('✅ KuCoin API connection successful');
    } catch (error) {
      throw new Error(`KuCoin API connection failed: ${error.message}`);
    }

    // Test LLM connection
    try {
      const llmHealth = await this.llm.healthCheck();
      if (llmHealth.healthy) {
        logger.info(`✅ LLM connection successful (latency: ${llmHealth.latency}ms)`);
      } else {
        logger.warn(`⚠️ LLM connection failed: ${llm.error}, using rule-based fallback`);
      }
    } catch (error) {
      logger.warn(`⚠️ LLM health check failed: ${error.message}, using rule-based fallback`);
    }
  }

  startMonitoring() {
    const interval = parseInt(process.env.CHECK_INTERVAL) || 60000;
    
    // Main trading loop
    this.tradingInterval = setInterval(async () => {
      try {
        await this.executeTradingCycle();
      } catch (error) {
        logger.error(`Trading cycle error: ${error.message}`);
        this.sendTelegramNotification(`❌ Trading cycle error: ${error.message}`);
      }
    }, interval);

    logger.info(`📊 24/7 monitoring started (check interval: ${interval}ms)`);
  }

  async executeTradingCycle() {
    const tradingPairs = this.getTradingPairs();
    
    for (const pair of tradingPairs) {
      try {
        await this.analyzeAndTrade(pair);
      } catch (error) {
        logger.error(`Error processing ${pair}: ${error.message}`);
      }
    }
  }

  async analyzeAndTrade(symbol) {
    // Get market data
    const marketData = await this.getMarketData(symbol);
    
    // Technical analysis
    const indicators = await this.technicalAnalysis.analyze(marketData);
    
    // LLM decision
    const llmDecision = await this.llm.generateTradingSignal({
      symbol,
      price: marketData.price,
      indicators,
      marketSummary: this.getMarketSummary(marketData),
      riskAssessment: this.getRiskAssessment(indicators)
    });

    // Strategy evaluation
    const strategySignal = this.strategyEngine.evaluate({
      symbol,
      indicators,
      llmDecision,
      marketData
    });

    if (strategySignal.confidence >= parseFloat(process.env.MIN_CONFIDENCE)) {
      await this.executeTrade(strategySignal, indicators);
    }
  }

  async getMarketData(symbol) {
    const ticker = await this.kucoin.getTicker(symbol);
    const klines = await this.kucoin.getKlines(symbol, '1hour', 100);
    
    return {
      symbol,
      price: parseFloat(ticker.price),
      volume: parseFloat(ticker.volume),
      change24h: parseFloat(ticker.changeRate),
      klines: klines.map(k => ({
        time: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }))
    };
  }

  getMarketSummary(marketData) {
    const trend = marketData.change24h > 0 ? 'bullish' : 'bearish';
    const strength = Math.abs(marketData.change24h);
    
    return `Market is ${trend} with ${strength.toFixed(2)}% 24h change. Volume: ${marketData.volume}`;
  }

  getRiskAssessment(indicators) {
    let risk = 'low';
    
    if (indicators.rsi > 70 || indicators.rsi < 30) {
      risk = 'high';
    } else if (indicators.rsi > 60 || indicators.rsi < 40) {
      risk = 'medium';
    }
    
    return `Risk level: ${risk} (RSI: ${indicators.rsi.toFixed(2)})`;
  }

  async executeTrade(signal, indicators) {
    const trade = {
      symbol: signal.symbol,
      side: signal.action.toLowerCase(),
      size: signal.size,
      entry: signal.price,
      confidence: signal.confidence,
      reasoning: signal.reasoning
    };

    // Risk evaluation
    const riskEvaluation = await this.riskManager.evaluateTrade(trade);
    
    if (!riskEvaluation.passed) {
      logger.warn(`Trade rejected by risk manager: ${riskEvaluation.reasons.join(', ')}`);
      return;
    }

    try {
      // Execute order
      const order = await this.kucoin.placeOrder({
        symbol: trade.symbol,
        side: trade.side,
        type: 'market',
        size: trade.size
      });

      // Record trade
      this.riskManager.recordTrade({
        ...trade,
        id: order.orderId,
        size: riskEvaluation.positionSize
      });

      logger.info(`✅ Trade executed: ${trade.symbol} ${trade.side} ${trade.size} @ ${trade.price}`);
      this.sendTelegramNotification(
        `📈 Trade executed: ${trade.symbol} ${trade.side.toUpperCase()} ${trade.size} @ $${trade.price}\n` +
        `Confidence: ${(trade.confidence * 100).toFixed(0)}%\n` +
        `Reasoning: ${trade.reasoning}`
      );

    } catch (error) {
      logger.error(`Trade execution failed: ${error.message}`);
      this.sendTelegramNotification(`❌ Trade failed: ${error.message}`);
    }
  }

  setupScheduledTasks() {
    // Daily summary at midnight
    cron.schedule('0 0 * * *', async () => {
      await this.sendDailySummary();
    });

    // Risk counter reset at midnight
    cron.schedule('0 0 * * *', () => {
      this.riskManager.resetDailyCounters();
    });

    // Health check every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.healthCheck();
    });

    logger.info('⏰ Scheduled tasks configured');
  }

  setupDailyReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow - now;
    setTimeout(() => this.riskManager.resetDailyCounters(), msUntilMidnight);
  }

  async sendDailySummary() {
    const summary = this.riskManager.getPortfolioSummary();
    
    const message = `📊 **Daily Trading Summary**

📈 Daily Trades: ${summary.dailyTrades}
💰 Daily Loss: $${summary.dailyLoss.toFixed(2)}
🔢 Active Positions: ${summary.activePositions}
📊 Remaining Trades: ${summary.remainingTrades}

Keep trading profitable! 🚀`;

    this.sendTelegramNotification(message);
    logger.info('Daily summary sent');
  }

  async healthCheck() {
    try {
      const portfolioSummary = this.riskManager.getPortfolioSummary();
      logger.info(`Health check - Daily trades: ${portfolioSummary.dailyTrades}, Active positions: ${portfolioSummary.activePositions}`);
    } catch (error) {
      logger.error(`Health check failed: ${error.message}`);
    }
  }

  getTradingPairs() {
    const pairs = process.env.TRADING_PAIRS || 'BTC-USDT,ETH-USDT,SOL-USDT';
    return pairs.split(',').map(p => p.trim());
  }

  sendTelegramNotification(message) {
    if (process.env.TELEGRAM_ENABLED === 'true') {
      // Telegram notification logic here
      logger.info(`Telegram notification: ${message.substring(0, 50)}...`);
    }
  }

  async stop() {
    if (!this.isRunning) {
      logger.warn('Bot is not running');
      return;
    }

    logger.info('🛑 Stopping bot...');
    clearInterval(this.tradingInterval);
    this.isRunning = false;
    logger.info('✅ Bot stopped successfully');
  }
}

// Main execution
const bot = new AgbaraAdvancedKuCoinBot();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await bot.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await bot.stop();
  process.exit(0);
});

// Start the bot
bot.start().catch(error => {
  logger.error(`Failed to start bot: ${error.message}`);
  process.exit(1);
});

module.exports = AgbaraAdvancedKuCoinBot;