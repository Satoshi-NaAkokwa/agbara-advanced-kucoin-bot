#!/usr/bin/env node

/**
 * SMART TRADING BOT v4.0 - Professional Grade
 * Features:
 * - Proper stop-loss/take-profit execution
 * - Real profit tracking and machine learning
 * - LLM-powered sentiment analysis
 * - Multi-asset portfolio management
 * - Intelligent exit strategies
 * - Fee-aware profit optimization
 */

require('dotenv').config();
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const axios = require('axios');

// Logger configuration
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
    new winston.transports.File({ filename: 'logs/smart-bot.log' })
  ]
});

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Trading Parameters
  maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE) || 3,
  minPositionSize: parseFloat(process.env.MIN_POSITION_SIZE) || 0.5,
  minConfidence: parseFloat(process.env.MIN_CONFIDENCE) || 0.55,
  tradingFee: 0.001, // 0.1% KuCoin fee
  minProfitThreshold: 0.003, // Minimum 0.3% profit to cover fees
  
  // Risk Management
  stopLossPercent: parseFloat(process.env.STOP_LOSS_PERCENT) || 2.0,
  takeProfitPercent: parseFloat(process.env.TAKE_PROFIT_PERCENT) || 4.0,
  trailingStopPercent: 1.5,
  maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS) || 50,
  maxDrawdown: 0.15, // 15% max drawdown
  maxPositionsPerPair: 3,
  maxTotalPositions: 10,
  
  // Multi-Asset Strategy
  tradingPairs: {
    momentum: ['BTC-USDT', 'ETH-USDT', 'SOL-USDT'],
    scalping: ['SOL-USDT', 'DOGE-USDT', 'PEPE-USDT', 'WIF-USDT'],
    meanReversion: ['BTC-USDT', 'ETH-USDT', 'XRP-USDT'],
    moonshot: ['PEPE-USDT', 'WIF-USDT', 'BONK-USDT', 'FLOKI-USDT']
  },
  
  // Portfolio Allocation
  allocation: {
    momentum: 0.35,
    scalping: 0.25,
    meanReversion: 0.25,
    moonshot: 0.15,
    reserve: 0.10 // Keep 10% in USDT for opportunities
  },
  
  // Check Intervals
  tradingInterval: 60000, // 1 minute for active trading
  portfolioRebalanceInterval: 300000, // 5 minutes
  
  // LLM Settings
  llmEnabled: process.env.LLM_ENDPOINT ? true : false,
  llmEndpoint: process.env.LLM_ENDPOINT || 'http://localhost:11434/api/generate',
  llmModel: process.env.LLM_MODEL || 'llama2',
  llmTimeout: 15000
};

// ============================================================================
// MAIN BOT CLASS
// ============================================================================

class SmartTradingBot {
  constructor() {
    // API Credentials
    this.apiKey = process.env.KUCOIN_API_KEY;
    this.secretKey = process.env.KUCOIN_SECRET_KEY;
    this.passphrase = process.env.KUCOIN_API_PASSPHRASE;
    this.baseUrl = 'api.kucoin.com';
    
    // State Management
    this.isRunning = false;
    this.portfolio = {};
    this.openPositions = new Map(); // Track all open positions
    this.tradeHistory = [];
    this.dailyPnL = 0;
    this.totalTrades = 0;
    this.winCount = 0;
    this.lossCount = 0;
    
    // Learning System
    this.strategyPerformance = {
      momentum: { wins: 0, losses: 0, totalProfit: 0, trades: [] },
      scalping: { wins: 0, losses: 0, totalProfit: 0, trades: [] },
      meanReversion: { wins: 0, losses: 0, totalProfit: 0, trades: [] },
      moonshot: { wins: 0, losses: 0, totalProfit: 0, trades: [] }
    };
    
    // Market Data Cache
    this.marketData = new Map();
    this.priceHistory = new Map();
    
    // Sentiment Analysis
    this.marketSentiment = 'neutral';
    this.fearGreedIndex = 50;
    
    // Load previous state
    this.loadState();
    
    logger.info('🤖 Smart Trading Bot v4.0 initialized');
    logger.info(`📊 Configuration loaded: Max Position $${CONFIG.maxPositionSize}, Min Confidence ${(CONFIG.minConfidence * 100).toFixed(0)}%`);
  }
  
  // ==========================================================================
  // API METHODS
  // ==========================================================================
  
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
  
  // ==========================================================================
  // PORTFOLIO MANAGEMENT
  // ==========================================================================
  
  async loadPortfolio() {
    try {
      const accounts = await this.makeRequest('GET', '/api/v1/accounts');
      
      this.portfolio = {
        usdt: 0,
        totalValue: 0,
        assets: {}
      };
      
      for (const acc of accounts) {
        if (acc.type === 'trade') {
          const balance = parseFloat(acc.balance);
          if (balance > 0) {
            this.portfolio.assets[acc.currency] = balance;
            if (acc.currency === 'USDT') {
              this.portfolio.usdt = balance;
            }
          }
        }
      }
      
      // Calculate total value in USDT
      const prices = await this.getAllPrices();
      let totalValue = this.portfolio.usdt;
      
      for (const [currency, amount] of Object.entries(this.portfolio.assets)) {
        if (currency !== 'USDT' && prices[`${currency}-USDT`]) {
          totalValue += amount * prices[`${currency}-USDT`];
        }
      }
      
      this.portfolio.totalValue = totalValue;
      
      logger.info(`💰 Portfolio: $${totalValue.toFixed(2)} USDT (Available: $${this.portfolio.usdt.toFixed(2)})`);
      
      return this.portfolio;
    } catch (error) {
      logger.error(`Failed to load portfolio: ${error.message}`);
      throw error;
    }
  }
  
  async getAllPrices() {
    const prices = {};
    const pairs = [
      'BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT', 'DOGE-USDT',
      'PEPE-USDT', 'WIF-USDT', 'BONK-USDT', 'FLOKI-USDT', 'SHIB-USDT'
    ];
    
    for (const pair of pairs) {
      try {
        const ticker = await this.makeRequest('GET', `/api/v1/market/orderbook/level1?symbol=${pair}`);
        if (ticker && ticker.price) {
          prices[pair] = parseFloat(ticker.price);
        }
      } catch (error) {
        // Skip pairs that don't exist
      }
    }
    
    return prices;
  }
  
  calculatePositionAllocation() {
    const availableCapital = this.portfolio.usdt * (1 - CONFIG.allocation.reserve);
    const allocations = {};
    
    for (const [strategy, percentage] of Object.entries(CONFIG.allocation)) {
      if (strategy !== 'reserve') {
        allocations[strategy] = availableCapital * percentage;
      }
    }
    
    return allocations;
  }
  
  // ==========================================================================
  // TECHNICAL ANALYSIS
  // ==========================================================================
  
  async analyzeMarket() {
    const analysis = {};
    const allPairs = [...new Set(Object.values(CONFIG.tradingPairs).flat())];
    
    logger.info(`\n📈 Analyzing ${allPairs.length} trading pairs...`);
    
    for (const pair of allPairs) {
      try {
        // Fetch klines (OHLCV data)
        const klines = await this.makeRequest('GET', `/api/v1/market/candles?symbol=${pair}&type=5min&limit=200`);
        
        if (!klines || klines.length < 50) {
          logger.warn(`Insufficient data for ${pair}: ${klines ? klines.length : 0} candles`);
          continue;
        }
        
        // KuCoin returns newest first, so reverse
        const closes = klines.map(k => parseFloat(k[2])).reverse();
        const highs = klines.map(k => parseFloat(k[3])).reverse();
        const lows = klines.map(k => parseFloat(k[4])).reverse();
        const volumes = klines.map(k => parseFloat(k[5])).reverse();
        const currentPrice = closes[closes.length - 1];
        
        // Calculate indicators
        analysis[pair] = {
          price: currentPrice,
          high: highs[highs.length - 1],
          low: lows[lows.length - 1],
          volume: volumes[volumes.length - 1],
          avgVolume: this.calculateAverage(volumes.slice(-20)),
          
          // Trend Indicators
          sma20: this.calculateSMA(closes, 20),
          sma50: this.calculateSMA(closes, 50),
          ema12: this.calculateEMA(closes, 12),
          ema26: this.calculateEMA(closes, 26),
          trend: this.determineTrend(closes),
          
          // Momentum Indicators
          rsi: this.calculateRSI(closes, 14),
          macd: this.calculateMACD(closes),
          macdSignal: null,
          macdHistogram: null,
          
          // Volatility
          bollingerBands: this.calculateBollingerBands(closes, 20),
          atr: this.calculateATR(highs, lows, closes, 14),
          volatility: this.calculateVolatility(closes),
          
          // Support/Resistance
          support: this.findSupport(lows.slice(-20)),
          resistance: this.findResistance(highs.slice(-20)),
          
          // Price Action
          priceChange24h: ((currentPrice - closes[0]) / closes[0]) * 100,
          priceChange1h: ((currentPrice - closes[closes.length - 12]) / closes[closes.length - 12]) * 100,
          
          // Timestamp
          timestamp: Date.now()
        };
        
        // Calculate MACD signal line
        const macdHistory = [];
        for (let i = 26; i < closes.length; i++) {
          macdHistory.push(this.calculateMACD(closes.slice(0, i + 1)));
        }
        analysis[pair].macdSignal = this.calculateEMA(macdHistory, 9);
        analysis[pair].macdHistogram = analysis[pair].macd - analysis[pair].macdSignal;
        
        // Store price history
        if (!this.priceHistory.has(pair)) {
          this.priceHistory.set(pair, []);
        }
        this.priceHistory.get(pair).push({ price: currentPrice, time: Date.now() });
        
        // Keep only last 100 price points
        if (this.priceHistory.get(pair).length > 100) {
          this.priceHistory.get(pair).shift();
        }
        
      } catch (error) {
        logger.error(`Error analyzing ${pair}: ${error.message}`);
      }
    }
    
    this.marketData = new Map(Object.entries(analysis));
    return analysis;
  }
  
  // Technical Analysis Helper Functions
  
  calculateSMA(prices, period) {
    if (prices.length < period) return prices[prices.length - 1];
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }
  
  calculateEMA(prices, period) {
    if (prices.length < period) return prices[prices.length - 1];
    const multiplier = 2 / (period + 1);
    let ema = this.calculateSMA(prices.slice(0, period), period);
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }
  
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;
    
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    
    const gains = changes.filter(c => c > 0);
    const losses = changes.filter(c => c < 0).map(c => Math.abs(c));
    
    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  calculateMACD(prices) {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    return ema12 - ema26;
  }
  
  calculateBollingerBands(prices, period = 20) {
    const sma = this.calculateSMA(prices, period);
    const slice = prices.slice(-period);
    const squaredDiffs = slice.map(p => Math.pow(p - sma, 2));
    const stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period);
    
    return {
      upper: sma + (stdDev * 2),
      middle: sma,
      lower: sma - (stdDev * 2),
      bandwidth: (stdDev * 4) / sma
    };
  }
  
  calculateATR(highs, lows, closes, period = 14) {
    const trueRanges = [];
    
    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }
    
    return this.calculateAverage(trueRanges.slice(-period));
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
  
  calculateAverage(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  
  determineTrend(prices) {
    const sma20 = this.calculateSMA(prices, 20);
    const sma50 = this.calculateSMA(prices, 50);
    const currentPrice = prices[prices.length - 1];
    
    if (currentPrice > sma20 && sma20 > sma50) return 'strong_bullish';
    if (currentPrice > sma20) return 'bullish';
    if (currentPrice < sma20 && sma20 < sma50) return 'strong_bearish';
    if (currentPrice < sma20) return 'bearish';
    return 'neutral';
  }
  
  findSupport(lows) {
    const sorted = [...lows].sort((a, b) => a - b);
    return sorted.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  }
  
  findResistance(highs) {
    const sorted = [...highs].sort((a, b) => b - a);
    return sorted.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  }
  
  // ==========================================================================
  // SENTIMENT ANALYSIS (LLM Integration)
  // ==========================================================================
  
  async analyzeSentiment() {
    if (!CONFIG.llmEnabled) {
      return this.calculateRuleBasedSentiment();
    }
    
    try {
      const marketSummary = this.buildMarketSummary();
      
      const prompt = `You are a cryptocurrency market sentiment analyst. Analyze the following market data and provide sentiment.

Market Summary:
${marketSummary}

Provide your analysis in this EXACT format:
SENTIMENT: [VERY_BULLISH/BULLISH/NEUTRAL/BEARISH/VERY_BEARISH]
CONFIDENCE: [0.0-1.0]
KEY_FACTORS: [List 2-3 main factors]
RECOMMENDED_ACTION: [AGGRESSIVE_BUY/BUY/HOLD/SELL/AGGRESSIVE_SELL]

Response:`;

      const response = await axios.post(CONFIG.llmEndpoint, {
        model: CONFIG.llmModel,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          max_tokens: 200
        }
      }, { timeout: CONFIG.llmTimeout });
      
      const result = this.parseSentimentResponse(response.data.response);
      this.marketSentiment = result.sentiment;
      this.fearGreedIndex = result.fearGreedIndex;
      
      logger.info(`🧠 LLM Sentiment: ${result.sentiment} (Confidence: ${(result.confidence * 100).toFixed(0)}%)`);
      
      return result;
      
    } catch (error) {
      logger.warn(`LLM sentiment analysis failed: ${error.message}`);
      return this.calculateRuleBasedSentiment();
    }
  }
  
  calculateRuleBasedSentiment() {
    let bullishScore = 0;
    let bearishScore = 0;
    let totalPairs = 0;
    
    for (const [pair, data] of this.marketData) {
      if (data.trend.includes('bullish')) bullishScore++;
      if (data.trend.includes('bearish')) bearishScore++;
      if (data.rsi > 70) bearishScore += 0.5;
      if (data.rsi < 30) bullishScore += 0.5;
      if (data.macdHistogram > 0) bullishScore += 0.3;
      if (data.macdHistogram < 0) bearishScore += 0.3;
      totalPairs++;
    }
    
    const netScore = (bullishScore - bearishScore) / Math.max(totalPairs, 1);
    
    let sentiment, fearGreedIndex;
    
    if (netScore > 0.5) {
      sentiment = 'VERY_BULLISH';
      fearGreedIndex = 80;
    } else if (netScore > 0.2) {
      sentiment = 'BULLISH';
      fearGreedIndex = 65;
    } else if (netScore < -0.5) {
      sentiment = 'VERY_BEARISH';
      fearGreedIndex = 20;
    } else if (netScore < -0.2) {
      sentiment = 'BEARISH';
      fearGreedIndex = 35;
    } else {
      sentiment = 'NEUTRAL';
      fearGreedIndex = 50;
    }
    
    this.marketSentiment = sentiment;
    this.fearGreedIndex = fearGreedIndex;
    
    logger.info(`📊 Rule-based Sentiment: ${sentiment} (Fear/Greed: ${fearGreedIndex})`);
    
    return { sentiment, fearGreedIndex, confidence: 0.7 };
  }
  
  buildMarketSummary() {
    let summary = '';
    
    for (const [pair, data] of this.marketData) {
      summary += `${pair}: $${data.price.toFixed(4)} | RSI: ${data.rsi.toFixed(1)} | Trend: ${data.trend} | Change: ${data.priceChange24h.toFixed(2)}%\n`;
    }
    
    return summary;
  }
  
  parseSentimentResponse(response) {
    const sentimentMatch = response.match(/SENTIMENT:\s*(VERY_BULLISH|BULLISH|NEUTRAL|BEARISH|VERY_BEARISH)/i);
    const confidenceMatch = response.match(/CONFIDENCE:\s*([0-9.]+)/i);
    
    const sentiment = sentimentMatch ? sentimentMatch[1].toUpperCase() : 'NEUTRAL';
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;
    
    // Convert sentiment to fear/greed index
    const fearGreedMap = {
      'VERY_BULLISH': 85,
      'BULLISH': 65,
      'NEUTRAL': 50,
      'BEARISH': 35,
      'VERY_BEARISH': 15
    };
    
    return {
      sentiment,
      confidence: Math.min(Math.max(confidence, 0), 1),
      fearGreedIndex: fearGreedMap[sentiment] || 50
    };
  }
  
  // ==========================================================================
  // SIGNAL GENERATION
  // ==========================================================================
  
  generateSignals() {
    const signals = [];
    
    logger.info(`\n🔍 Generating signals for ${this.marketData.size} pairs...`);
    
    for (const [pair, data] of this.marketData) {
      // Determine which strategy applies to this pair
      const strategies = this.getApplicableStrategies(pair);
      
      for (const strategy of strategies) {
        const signal = this.generateStrategySignal(pair, data, strategy);
        
        if (signal && signal.action !== 'hold') {
          logger.info(`  ${pair} (${strategy}): ${signal.action.toUpperCase()} @ ${(signal.confidence * 100).toFixed(0)}% confidence`);
          if (signal.confidence >= CONFIG.minConfidence) {
            signals.push(signal);
          } else {
            logger.info(`    ❌ Below threshold (${(signal.confidence * 100).toFixed(0)}% < ${(CONFIG.minConfidence * 100).toFixed(0)}%)`);
          }
        }
      }
    }
    
    // Sort by confidence
    signals.sort((a, b) => b.confidence - a.confidence);
    
    return signals;
  }
  
  getApplicableStrategies(pair) {
    const strategies = [];
    
    for (const [strategy, pairs] of Object.entries(CONFIG.tradingPairs)) {
      if (pairs.includes(pair)) {
        strategies.push(strategy);
      }
    }
    
    return strategies;
  }
  
  generateStrategySignal(pair, data, strategy) {
    const signal = {
      pair,
      strategy,
      action: 'hold',
      confidence: 0,
      reasons: [],
      entryPrice: data.price,
      stopLoss: null,
      takeProfit: null,
      positionSize: 0
    };
    
    switch (strategy) {
      case 'momentum':
        this.analyzeMomentum(signal, data);
        break;
      case 'scalping':
        this.analyzeScalping(signal, data);
        break;
      case 'meanReversion':
        this.analyzeMeanReversion(signal, data);
        break;
      case 'moonshot':
        this.analyzeMoonshot(signal, data);
        break;
    }
    
    // Apply sentiment adjustment
    if (signal.action !== 'hold') {
      signal.confidence = this.adjustForSentiment(signal.confidence);
    }
    
    return signal;
  }
  
  analyzeMomentum(signal, data) {
    const { rsi, macd, macdHistogram, trend, sma20, sma50, price, volume, avgVolume } = data;
    
    let buyScore = 0;
    let sellScore = 0;
    const reasons = [];
    
    // Trend following
    if (trend === 'strong_bullish') {
      buyScore += 0.3;
      reasons.push('Strong bullish trend');
    } else if (trend === 'strong_bearish') {
      sellScore += 0.3;
      reasons.push('Strong bearish trend');
    }
    
    // RSI momentum
    if (rsi > 50 && rsi < 70) {
      buyScore += 0.2;
      reasons.push('RSI bullish momentum');
    } else if (rsi < 50 && rsi > 30) {
      sellScore += 0.2;
      reasons.push('RSI bearish momentum');
    }
    
    // MACD confirmation
    if (macdHistogram > 0 && macd > 0) {
      buyScore += 0.25;
      reasons.push('MACD bullish');
    } else if (macdHistogram < 0 && macd < 0) {
      sellScore += 0.25;
      reasons.push('MACD bearish');
    }
    
    // Volume confirmation
    if (volume > avgVolume * 1.3) {
      if (buyScore > sellScore) {
        buyScore += 0.15;
        reasons.push('High volume confirms');
      } else if (sellScore > buyScore) {
        sellScore += 0.15;
        reasons.push('High volume confirms');
      }
    }
    
    // Generate signal
    if (buyScore >= 0.5) {
      signal.action = 'buy';
      signal.confidence = Math.min(buyScore, 0.9);
      signal.reasons = reasons;
      this.setRiskManagement(signal, data, 'momentum');
    } else if (sellScore >= 0.5) {
      signal.action = 'sell';
      signal.confidence = Math.min(sellScore, 0.9);
      signal.reasons = reasons;
    }
    
    // Log analysis
    if (buyScore > 0.3 || sellScore > 0.3) {
      logger.info(`    Momentum: buyScore=${buyScore.toFixed(2)}, sellScore=${sellScore.toFixed(2)}, trend=${trend}, RSI=${rsi.toFixed(1)}, MACD=${macd.toFixed(2)}`);
    }
  }
  
  analyzeScalping(signal, data) {
    const { rsi, price, volume, avgVolume, bollingerBands, priceChange1h } = data;
    
    let buyScore = 0;
    let sellScore = 0;
    const reasons = [];
    
    // Bollinger Band bounce
    if (price <= bollingerBands.lower * 1.01 && rsi < 40) {
      buyScore += 0.35;
      reasons.push('BB lower bounce setup');
    } else if (price >= bollingerBands.upper * 0.99 && rsi > 60) {
      sellScore += 0.35;
      reasons.push('BB upper rejection');
    }
    
    // Volume spike
    if (volume > avgVolume * 2) {
      if (priceChange1h > 0) {
        buyScore += 0.3;
        reasons.push('Volume spike upward');
      } else {
        sellScore += 0.3;
        reasons.push('Volume spike downward');
      }
    }
    
    // RSI extremes for scalping
    if (rsi < 35) {
      buyScore += 0.2;
      reasons.push('RSI oversold');
    } else if (rsi > 65) {
      sellScore += 0.2;
      reasons.push('RSI overbought');
    }
    
    if (buyScore >= 0.4) {
      signal.action = 'buy';
      signal.confidence = Math.min(buyScore, 0.85);
      signal.reasons = reasons;
      this.setRiskManagement(signal, data, 'scalping');
    } else if (sellScore >= 0.4) {
      signal.action = 'sell';
      signal.confidence = Math.min(sellScore, 0.85);
      signal.reasons = reasons;
    }
  }
  
  analyzeMeanReversion(signal, data) {
    const { rsi, price, sma20, bollingerBands, priceChange24h } = data;
    
    let buyScore = 0;
    let sellScore = 0;
    const reasons = [];
    
    // Mean reversion from extremes
    if (rsi < 25 && price < bollingerBands.lower) {
      buyScore += 0.4;
      reasons.push('Extreme oversold - mean reversion');
    } else if (rsi > 75 && price > bollingerBands.upper) {
      sellScore += 0.4;
      reasons.push('Extreme overbought - mean reversion');
    }
    
    // Price deviation from SMA
    const deviation = (price - sma20) / sma20;
    if (deviation < -0.03) { // 3% below SMA
      buyScore += 0.3;
      reasons.push('Price significantly below SMA');
    } else if (deviation > 0.03) { // 3% above SMA
      sellScore += 0.3;
      reasons.push('Price significantly above SMA');
    }
    
    // 24h price drop/pump
    if (priceChange24h < -5) {
      buyScore += 0.2;
      reasons.push('Significant 24h drop');
    } else if (priceChange24h > 5) {
      sellScore += 0.2;
      reasons.push('Significant 24h pump');
    }
    
    if (buyScore >= 0.45) {
      signal.action = 'buy';
      signal.confidence = Math.min(buyScore, 0.85);
      signal.reasons = reasons;
      this.setRiskManagement(signal, data, 'meanReversion');
    } else if (sellScore >= 0.45) {
      signal.action = 'sell';
      signal.confidence = Math.min(sellScore, 0.85);
      signal.reasons = reasons;
    }
  }
  
  analyzeMoonshot(signal, data) {
    const { rsi, volume, avgVolume, priceChange1h, priceChange24h, trend } = data;
    
    let buyScore = 0;
    const reasons = [];
    
    // Moonshot: high risk, high reward
    if (volume > avgVolume * 3 && priceChange1h > 3) {
      buyScore += 0.4;
      reasons.push('Massive volume spike with price surge');
    }
    
    if (priceChange24h > 10 && rsi < 75) {
      buyScore += 0.3;
      reasons.push('Strong momentum, RSI not exhausted');
    }
    
    if (trend === 'strong_bullish' && volume > avgVolume * 2) {
      buyScore += 0.25;
      reasons.push('Strong trend with volume');
    }
    
    if (buyScore >= 0.5) {
      signal.action = 'buy';
      signal.confidence = Math.min(buyScore, 0.75); // Cap confidence for moonshots
      signal.reasons = reasons;
      this.setRiskManagement(signal, data, 'moonshot');
    }
  }
  
  adjustForSentiment(confidence) {
    // Reduce sentiment impact for mixed markets
    const sentimentMultiplier = {
      'VERY_BULLISH': 1.15,
      'BULLISH': 1.08,
      'NEUTRAL': 1.0,
      'BEARISH': 0.95,
      'VERY_BEARISH': 0.90
    };
    
    return confidence * (sentimentMultiplier[this.marketSentiment] || 1.0);
  }
  
  // ==========================================================================
  // RISK MANAGEMENT & POSITION SIZING
  // ==========================================================================
  
  setRiskManagement(signal, data, strategy) {
    const { price, atr, support, resistance } = data;
    
    // Dynamic stop loss based on ATR
    const atrMultiplier = strategy === 'moonshot' ? 2.5 : strategy === 'scalping' ? 1.5 : 2.0;
    const atrStopLoss = atr * atrMultiplier;
    
    // Calculate stop loss price
    if (signal.action === 'buy') {
      const stopLossPrice = Math.max(
        price - atrStopLoss,
        price * (1 - CONFIG.stopLossPercent / 100),
        support
      );
      signal.stopLoss = stopLossPrice;
      signal.stopLossPercent = ((price - stopLossPrice) / price) * 100;
      
      // Take profit based on risk-reward ratio (minimum 2:1)
      const riskAmount = price - stopLossPrice;
      signal.takeProfit = price + (riskAmount * 2.5);
      signal.takeProfitPercent = ((signal.takeProfit - price) / price) * 100;
    }
    
    // Ensure minimum profit covers fees
    const minProfitPercent = CONFIG.minProfitThreshold * 100 * 2; // Double the fee cost
    if (signal.takeProfitPercent < minProfitPercent) {
      signal.takeProfit = price * (1 + minProfitPercent / 100);
      signal.takeProfitPercent = minProfitPercent;
    }
    
    // Position size based on confidence and strategy allocation
    const allocations = this.calculatePositionAllocation();
    const strategyAllocation = allocations[strategy] || CONFIG.maxPositionSize;
    
    signal.positionSize = Math.min(
      strategyAllocation * signal.confidence,
      CONFIG.maxPositionSize,
      this.portfolio.usdt * 0.9 // Never use more than 90% of available USDT
    );
    
    // Ensure minimum position size
    if (signal.positionSize < CONFIG.minPositionSize) {
      signal.action = 'hold'; // Don't trade if too small
    }
  }
  
  // ==========================================================================
  // POSITION MANAGEMENT & EXIT STRATEGIES
  // ==========================================================================
  
  async manageOpenPositions() {
    for (const [positionId, position] of this.openPositions) {
      try {
        const currentPrice = await this.getCurrentPrice(position.pair);
        const pnlPercent = position.action === 'buy' 
          ? ((currentPrice - position.entryPrice) / position.entryPrice) * 100
          : ((position.entryPrice - currentPrice) / position.entryPrice) * 100;
        
        const pnl = position.action === 'buy'
          ? (currentPrice - position.entryPrice) * position.size
          : (position.entryPrice - currentPrice) * position.size;
        
        // Update trailing stop
        if (pnlPercent > 1) {
          const newTrailingStop = currentPrice * (1 - CONFIG.trailingStopPercent / 100);
          if (!position.trailingStop || newTrailingStop > position.trailingStop) {
            position.trailingStop = newTrailingStop;
            logger.info(`📈 Updated trailing stop for ${position.pair}: $${newTrailingStop.toFixed(4)}`);
          }
        }
        
        // Check exit conditions
        let shouldExit = false;
        let exitReason = '';
        
        // Stop loss hit
        if (currentPrice <= position.stopLoss) {
          shouldExit = true;
          exitReason = 'Stop loss triggered';
        }
        
        // Trailing stop hit
        if (position.trailingStop && currentPrice <= position.trailingStop) {
          shouldExit = true;
          exitReason = 'Trailing stop triggered';
        }
        
        // Take profit hit
        if (currentPrice >= position.takeProfit) {
          shouldExit = true;
          exitReason = 'Take profit reached';
        }
        
        // Time-based exit (max 4 hours)
        const holdingTime = Date.now() - position.timestamp;
        if (holdingTime > 4 * 60 * 60 * 1000) {
          if (pnlPercent > 0.5) {
            shouldExit = true;
            exitReason = 'Time-based profit taking';
          }
        }
        
        // Execute exit
        if (shouldExit) {
          await this.closePosition(position, currentPrice, exitReason);
        }
        
        // Log position status
        logger.info(`📊 ${position.pair}: PnL ${pnlPercent.toFixed(2)}% ($${pnl.toFixed(2)}) | Stop: $${position.stopLoss.toFixed(4)} | TP: $${position.takeProfit.toFixed(4)}`);
        
      } catch (error) {
        logger.error(`Error managing position ${positionId}: ${error.message}`);
      }
    }
  }
  
  async getCurrentPrice(pair) {
    const ticker = await this.makeRequest('GET', `/api/v1/market/orderbook/level1?symbol=${pair}`);
    return parseFloat(ticker.price);
  }
  
  async closePosition(position, currentPrice, reason) {
    try {
      const baseCurrency = position.pair.split('-')[0];
      
      // Execute sell order
      const order = await this.makeRequest('POST', '/api/v1/orders', JSON.stringify({
        clientOid: `close-${Date.now()}`,
        side: 'sell',
        symbol: position.pair,
        type: 'market',
        size: position.size.toString()
      }));
      
      // Calculate actual PnL
      const pnl = (currentPrice - position.entryPrice) * position.size;
      const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
      
      // Record trade for learning
      const trade = {
        pair: position.pair,
        strategy: position.strategy,
        action: 'sell',
        entryPrice: position.entryPrice,
        exitPrice: currentPrice,
        size: position.size,
        pnl,
        pnlPercent,
        reason,
        timestamp: Date.now(),
        holdingTime: Date.now() - position.timestamp
      };
      
      this.tradeHistory.push(trade);
      this.totalTrades++;
      
      if (pnl > 0) {
        this.winCount++;
        this.strategyPerformance[position.strategy].wins++;
        this.strategyPerformance[position.strategy].totalProfit += pnl;
        logger.info(`✅ PROFIT: ${position.pair} +${pnlPercent.toFixed(2)}% (+$${pnl.toFixed(2)}) - ${reason}`);
      } else {
        this.lossCount++;
        this.strategyPerformance[position.strategy].losses++;
        this.strategyPerformance[position.strategy].totalProfit += pnl;
        logger.warn(`❌ LOSS: ${position.pair} ${pnlPercent.toFixed(2)}% ($${pnl.toFixed(2)}) - ${reason}`);
      }
      
      // Remove from open positions
      this.openPositions.delete(position.id);
      
      // Update daily PnL
      this.dailyPnL += pnl;
      
      // Save state
      this.saveState();
      
      logger.info(`📤 Closed position: ${position.pair} @ $${currentPrice.toFixed(4)} | Order: ${order.orderId}`);
      
    } catch (error) {
      logger.error(`Failed to close position: ${error.message}`);
    }
  }
  
  // ==========================================================================
  // TRADE EXECUTION
  // ==========================================================================
  
  async executeSignals(signals) {
    // Check daily loss limit
    if (this.dailyPnL <= -CONFIG.maxDailyLoss) {
      logger.warn(`🛑 Daily loss limit reached: $${this.dailyPnL.toFixed(2)}`);
      return;
    }
    
    // Check max positions
    if (this.openPositions.size >= CONFIG.maxTotalPositions) {
      logger.info(`Maximum positions reached: ${this.openPositions.size}/${CONFIG.maxTotalPositions}`);
      return;
    }
    
    for (const signal of signals) {
      // Check if we already have a position in this pair
      const hasPosition = Array.from(this.openPositions.values()).some(p => p.pair === signal.pair);
      if (hasPosition) {
        logger.info(`Already have position in ${signal.pair}, skipping`);
        continue;
      }
      
      // Check if we have enough USDT
      if (this.portfolio.usdt < signal.positionSize) {
        logger.warn(`Insufficient USDT for ${signal.pair}: need $${signal.positionSize.toFixed(2)}, have $${this.portfolio.usdt.toFixed(2)}`);
        continue;
      }
      
      await this.executeTrade(signal);
    }
  }
  
  async executeTrade(signal) {
    const { pair, action, confidence, reasons, entryPrice, stopLoss, takeProfit, positionSize, strategy } = signal;
    
    logger.info(`\n🎯 EXECUTING TRADE: ${action.toUpperCase()} ${pair}`);
    logger.info(`   Confidence: ${(confidence * 100).toFixed(0)}%`);
    logger.info(`   Position Size: $${positionSize.toFixed(2)}`);
    logger.info(`   Entry Target: $${entryPrice.toFixed(4)}`);
    logger.info(`   Stop Loss: $${stopLoss.toFixed(4)} (${signal.stopLossPercent.toFixed(2)}%)`);
    logger.info(`   Take Profit: $${takeProfit.toFixed(4)} (${signal.takeProfitPercent.toFixed(2)}%)`);
    logger.info(`   Reasons: ${reasons.join(', ')}`);
    
    try {
      // Get current price
      const currentPrice = await this.getCurrentPrice(pair);
      
      // Calculate size in base currency
      const size = positionSize / currentPrice;
      
      // Execute buy order
      const order = await this.makeRequest('POST', '/api/v1/orders', JSON.stringify({
        clientOid: `bot-${Date.now()}`,
        side: 'buy',
        symbol: pair,
        type: 'market',
        funds: positionSize.toString()
      }));
      
      logger.info(`✅ BUY EXECUTED: ${pair} - $${positionSize.toFixed(2)} @ $${currentPrice.toFixed(4)}`);
      logger.info(`   Order ID: ${order.orderId}`);
      
      // Create position record
      const position = {
        id: `pos-${Date.now()}`,
        pair,
        strategy,
        action: 'buy',
        entryPrice: currentPrice,
        size,
        positionSize,
        stopLoss,
        takeProfit,
        trailingStop: null,
        confidence,
        reasons,
        orderId: order.orderId,
        timestamp: Date.now()
      };
      
      // Add to open positions
      this.openPositions.set(position.id, position);
      
      // Update portfolio
      this.portfolio.usdt -= positionSize;
      
      // Save state
      this.saveState();
      
      logger.info(`📌 Position opened: ${position.id}`);
      
    } catch (error) {
      logger.error(`❌ Trade execution failed: ${error.message}`);
    }
  }
  
  // ==========================================================================
  // LEARNING & ADAPTATION
  // ==========================================================================
  
  learnFromTrades() {
    if (this.tradeHistory.length < 5) return;
    
    logger.info('\n📚 LEARNING FROM TRADES...');
    
    // Analyze recent trades
    const recentTrades = this.tradeHistory.slice(-20);
    
    // Calculate win rate per strategy
    for (const [strategy, perf] of Object.entries(this.strategyPerformance)) {
      const totalTrades = perf.wins + perf.losses;
      if (totalTrades > 0) {
        const winRate = perf.wins / totalTrades;
        const avgProfit = perf.totalProfit / totalTrades;
        
        logger.info(`   ${strategy}: Win Rate ${(winRate * 100).toFixed(1)}% | Avg Profit $${avgProfit.toFixed(2)} | Total $${perf.totalProfit.toFixed(2)}`);
        
        // Adjust strategy allocation based on performance
        if (winRate > 0.6 && avgProfit > 0) {
          CONFIG.allocation[strategy] = Math.min(CONFIG.allocation[strategy] * 1.1, 0.45);
          logger.info(`   ↑ Increased ${strategy} allocation to ${(CONFIG.allocation[strategy] * 100).toFixed(1)}%`);
        } else if (winRate < 0.4 || avgProfit < 0) {
          CONFIG.allocation[strategy] = Math.max(CONFIG.allocation[strategy] * 0.9, 0.1);
          logger.info(`   ↓ Decreased ${strategy} allocation to ${(CONFIG.allocation[strategy] * 100).toFixed(1)}%`);
        }
      }
    }
    
    // Normalize allocations
    const totalAllocation = Object.values(CONFIG.allocation).filter(v => v > 0).reduce((a, b) => a + b, 0);
    for (const strategy of Object.keys(CONFIG.allocation)) {
      if (CONFIG.allocation[strategy] > 0) {
        CONFIG.allocation[strategy] /= totalAllocation;
      }
    }
    
    logger.info(`\n📊 Updated Allocations:`);
    for (const [strategy, allocation] of Object.entries(CONFIG.allocation)) {
      logger.info(`   ${strategy}: ${(allocation * 100).toFixed(1)}%`);
    }
    
    this.saveState();
  }
  
  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  
  saveState() {
    try {
      const state = {
        portfolio: this.portfolio,
        openPositions: Array.from(this.openPositions.entries()),
        tradeHistory: this.tradeHistory.slice(-100), // Keep last 100 trades
        dailyPnL: this.dailyPnL,
        totalTrades: this.totalTrades,
        winCount: this.winCount,
        lossCount: this.lossCount,
        strategyPerformance: this.strategyPerformance,
        marketSentiment: this.marketSentiment,
        fearGreedIndex: this.fearGreedIndex,
        config: CONFIG.allocation,
        lastSaved: Date.now()
      };
      
      fs.writeFileSync(path.join(__dirname, 'bot-state.json'), JSON.stringify(state, null, 2));
    } catch (error) {
      logger.error(`Failed to save state: ${error.message}`);
    }
  }
  
  loadState() {
    try {
      const statePath = path.join(__dirname, 'bot-state.json');
      if (fs.existsSync(statePath)) {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        
        // Restore state
        if (state.openPositions) {
          this.openPositions = new Map(state.openPositions);
        }
        if (state.tradeHistory) {
          this.tradeHistory = state.tradeHistory;
        }
        if (state.strategyPerformance) {
          this.strategyPerformance = state.strategyPerformance;
        }
        if (state.totalTrades) {
          this.totalTrades = state.totalTrades;
          this.winCount = state.winCount || 0;
          this.lossCount = state.lossCount || 0;
        }
        if (state.config) {
          CONFIG.allocation = state.config;
        }
        
        logger.info(`📚 Loaded previous state: ${this.totalTrades} trades, ${this.winCount} wins, ${this.lossCount} losses`);
        
        // Reset daily PnL if new day
        const lastSaved = state.lastSaved || 0;
        const lastDate = new Date(lastSaved).toDateString();
        const today = new Date().toDateString();
        
        if (lastDate !== today) {
          this.dailyPnL = 0;
          logger.info('📅 New trading day - daily PnL reset');
        } else {
          this.dailyPnL = state.dailyPnL || 0;
        }
      }
    } catch (error) {
      logger.warn(`Could not load previous state: ${error.message}`);
    }
  }
  
  // ==========================================================================
  // MAIN TRADING LOOP
  // ==========================================================================
  
  async start() {
    logger.info('\n🚀 STARTING SMART TRADING BOT v4.0\n');
    
    try {
      // Initial portfolio load
      await this.loadPortfolio();
      
      // Initial market analysis
      await this.analyzeMarket();
      
      // Initial sentiment analysis
      await this.analyzeSentiment();
      
      // Check for existing positions to manage
      if (this.openPositions.size > 0) {
        logger.info(`\n📊 Managing ${this.openPositions.size} existing positions...`);
        await this.manageOpenPositions();
      }
      
      // Start trading loop
      this.isRunning = true;
      let cycleCount = 0;
      
      const mainLoop = async () => {
        if (!this.isRunning) return;
        
        cycleCount++;
        logger.info(`\n${'='.repeat(60)}`);
        logger.info(`🔄 TRADING CYCLE #${cycleCount}`);
        logger.info(`${'='.repeat(60)}`);
        
        try {
          // 1. Update portfolio
          await this.loadPortfolio();
          
          // 2. Analyze market
          await this.analyzeMarket();
          
          // 3. Analyze sentiment
          await this.analyzeSentiment();
          
          // 4. Manage existing positions
          await this.manageOpenPositions();
          
          // 5. Generate signals
          const signals = this.generateSignals();
          logger.info(`\n📊 Generated ${signals.length} signals`);
          
          // 6. Execute trades
          if (signals.length > 0) {
            await this.executeSignals(signals);
          }
          
          // 7. Learn and adapt (every 10 cycles)
          if (cycleCount % 10 === 0) {
            this.learnFromTrades();
          }
          
          // 8. Display stats
          this.displayStats();
          
        } catch (error) {
          logger.error(`❌ Trading cycle error: ${error.message}`);
        }
        
        // Schedule next cycle
        setTimeout(mainLoop, CONFIG.tradingInterval);
      };
      
      // Start the loop
      mainLoop();
      
    } catch (error) {
      logger.error(`❌ Failed to start bot: ${error.message}`);
      throw error;
    }
  }
  
  displayStats() {
    const winRate = this.totalTrades > 0 ? (this.winCount / this.totalTrades * 100).toFixed(1) : 0;
    
    logger.info(`\n📊 SESSION STATISTICS:`);
    logger.info(`   Total Trades: ${this.totalTrades}`);
    logger.info(`   Wins: ${this.winCount} | Losses: ${this.lossCount}`);
    logger.info(`   Win Rate: ${winRate}%`);
    logger.info(`   Daily PnL: $${this.dailyPnL.toFixed(2)}`);
    logger.info(`   Open Positions: ${this.openPositions.size}`);
    logger.info(`   Market Sentiment: ${this.marketSentiment}`);
    logger.info(`   Fear/Greed Index: ${this.fearGreedIndex}`);
  }
  
  async stop() {
    logger.info('\n🛑 STOPPING BOT...');
    this.isRunning = false;
    this.saveState();
    
    // Close all positions if needed
    if (this.openPositions.size > 0) {
      logger.info(`Closing ${this.openPositions.size} open positions...`);
      for (const [id, position] of this.openPositions) {
        try {
          const currentPrice = await this.getCurrentPrice(position.pair);
          await this.closePosition(position, currentPrice, 'Bot shutdown');
        } catch (error) {
          logger.error(`Failed to close position ${id}: ${error.message}`);
        }
      }
    }
    
    logger.info('✅ Bot stopped gracefully');
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

const bot = new SmartTradingBot();

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutdown signal received...');
  await bot.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await bot.stop();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  bot.saveState();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});

// Start the bot
bot.start().catch(error => {
  logger.error(`Failed to start bot: ${error.message}`);
  process.exit(1);
});

module.exports = SmartTradingBot;