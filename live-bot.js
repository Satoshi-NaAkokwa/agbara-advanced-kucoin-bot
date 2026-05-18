#!/usr/bin/env node

/**
 * Agbara Advanced KuCoin Trading Bot - LIVE MODE
 * Real trading with verified KuCoin API credentials
 */

require('dotenv').config();
const winston = require('winston');
const https = require('https');
const crypto = require('crypto');

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/bot-live.log' })
  ]
});

class LiveTradingBot {
  constructor() {
    this.apiKey = process.env.KUCOIN_API_KEY;
    this.secretKey = process.env.KUCOIN_SECRET_KEY;
    this.passphrase = process.env.KUCOIN_API_PASSPHRASE;
    this.baseUrl = 'api.kucoin.com';
    this.isRunning = false;
    this.positions = new Map();
    this.tradesExecuted = 0;
    this.profit = 0;
    this.tradingRules = new Map();
    
    // Trading configuration
    this.maxPositionSize = parseFloat(process.env.MAX_POSITION_SIZE) || 6;
    this.tradingPairs = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT'];
  }

  async loadTradingRules() {
    logger.info('📋 Loading trading rules...');
    
    for (const symbol of this.tradingPairs) {
      try {
        const symbols = await this.makeRequest('GET', '/api/v1/symbols');
        const symbolInfo = symbols.find(s => s.symbol === symbol);
        
        if (symbolInfo) {
          this.tradingRules.set(symbol, {
            baseMinSize: parseFloat(symbolInfo.baseMinSize),
            baseMaxSize: parseFloat(symbolInfo.baseMaxSize),
            quoteMinSize: parseFloat(symbolInfo.quoteMinSize),
            priceIncrement: parseFloat(symbolInfo.priceIncrement),
            baseIncrement: parseFloat(symbolInfo.baseIncrement)
          });
          logger.info(`   ${symbol}: min size ${symbolInfo.baseMinSize}, min value $${symbolInfo.quoteMinSize}`);
        }
      } catch (error) {
        logger.error(`Failed to load rules for ${symbol}: ${error.message}`);
      }
    }
  }

  calculateOrderSize(symbol, price, side) {
    const rules = this.tradingRules.get(symbol);
    if (!rules) {
      logger.warn(`No trading rules for ${symbol}`);
      return null;
    }

    // Calculate size based on max position value
    let size = this.maxPositionSize / price;
    
    // Apply minimum size requirements
    size = Math.max(size, rules.baseMinSize);
    size = Math.min(size, rules.baseMaxSize);
    
    // Round to base increment
    const increment = rules.baseIncrement;
    size = Math.floor(size / increment) * increment;
    
    // Ensure minimum order value
    const orderValue = size * price;
    if (orderValue < rules.quoteMinSize) {
      size = rules.quoteMinSize / price;
      size = Math.ceil(size / increment) * increment;
    }
    
    // Final safety check
    if (size < rules.baseMinSize || size > rules.baseMaxSize) {
      logger.warn(`Invalid size for ${symbol}: ${size} (min: ${rules.baseMinSize}, max: ${rules.baseMaxSize})`);
      return null;
    }
    
    return size;
  }

  sign(str) {
    return crypto.createHmac('sha256', this.secretKey).update(str).digest('base64');
  }

  getTimestamp() {
    return Date.now().toString();
  }

  async makeRequest(method, endpoint, body = '') {
    return new Promise((resolve, reject) => {
      const timestamp = this.getTimestamp();
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
        res.on('data', (chunk) => {
          data += chunk;
        });
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

      req.on('error', (error) => {
        reject(error);
      });

      if (body) {
        req.write(body);
      }

      req.end();
    });
  }

  async start() {
    logger.info('🚀 Starting Agbara Advanced KuCoin Trading Bot (LIVE MODE)');
    logger.info('⚠️  REAL MONEY TRADING - USE CAUTION');
    
    try {
      // Test connection
      const accounts = await this.makeRequest('GET', '/api/v1/accounts');
      logger.info(`✅ Connected to KuCoin API`);
      logger.info(`   Found ${accounts.length} accounts`);
      
      // Get USDT balance
      const usdtAccount = accounts.find(acc => acc.currency === 'USDT' && acc.type === 'trade');
      if (usdtAccount) {
        logger.info(`💰 USDT Balance: ${usdtAccount.available} (max position: ${this.maxPositionSize} USDT)`);
      }
      
      // Get trading rules for minimum sizes
      await this.loadTradingRules();
      
      this.isRunning = true;
      this.startTradingLoop();
      
    } catch (error) {
      logger.error(`❌ Failed to start bot: ${error.message}`);
      throw error;
    }
  }

  startTradingLoop() {
    let iteration = 0;
    
    const tradeLoop = async () => {
      if (!this.isRunning) return;
      
      iteration++;
      logger.info(`\n📊 Trading Cycle #${iteration}`);
      
      try {
        for (const pair of this.tradingPairs) {
          await this.analyzeAndTrade(pair);
        }
        
        // Print portfolio summary
        await this.printPortfolioSummary();
        
      } catch (error) {
        logger.error(`Trading cycle error: ${error.message}`);
      }
      
      // Schedule next cycle
      setTimeout(tradeLoop, 60000); // 1 minute between cycles
    };
    
    tradeLoop();
  }

  async analyzeAndTrade(symbol) {
    try {
      // Get market data
      const ticker = await this.makeRequest('GET', `/api/v1/market/orderbook/level1?symbol=${symbol}`);
      const price = parseFloat(ticker.price);
      
      // Simulate technical analysis
      const analysis = this.getTechnicalAnalysis(price);
      
      // Simple trading logic based on analysis
      const decision = this.makeTradingDecision(symbol, price, analysis);
      
      if (decision.action === 'buy' && decision.confidence > 0.7) {
        await this.executeTrade(symbol, 'buy', decision.size, price);
      } else if (decision.action === 'sell' && decision.confidence > 0.7) {
        await this.executeTrade(symbol, 'sell', decision.size, price);
      }
      
    } catch (error) {
      logger.error(`Error processing ${symbol}: ${error.message}`);
    }
  }

  getTechnicalAnalysis(currentPrice) {
    // Simple random technical analysis for demo
    const rsi = 30 + Math.random() * 40;
    const macd = (Math.random() - 0.5) * 100;
    
    return {
      rsi,
      macd,
      signal: rsi < 35 ? 'oversold' : rsi > 65 ? 'overbought' : 'neutral'
    };
  }

  makeTradingDecision(symbol, price, analysis) {
    if (analysis.signal === 'oversold') {
      const size = this.calculateOrderSize(symbol, price, 'buy');
      if (size) {
        return { 
          action: 'buy', 
          confidence: 0.75 + Math.random() * 0.15, 
          size: size,
          price 
        };
      }
    } else if (analysis.signal === 'overbought') {
      const position = this.positions.get(symbol);
      if (position) {
        return { 
          action: 'sell', 
          confidence: 0.75 + Math.random() * 0.15, 
          size: position.size, 
          price 
        };
      }
    }
    return { action: 'hold', confidence: 0.5, size: 0, price };
  }

  async executeTrade(symbol, side, size, price) {
    try {
      if (side === 'buy') {
        const tradeValue = size * price;
        
        if (tradeValue > this.maxPositionSize) {
          logger.warn(`❌ Trade value $${tradeValue.toFixed(2)} exceeds max position $${this.maxPositionSize}`);
          return;
        }
        
        // Recalculate size to ensure it meets trading rules
        const calculatedSize = this.calculateOrderSize(symbol, price, 'buy');
        if (!calculatedSize) {
          logger.warn(`❌ Cannot calculate valid order size for ${symbol}`);
          return;
        }
        
        // Create buy order
        const orderParams = {
          clientOid: `bot-${symbol}-${Date.now()}`,
          side: 'buy',
          symbol: symbol,
          type: 'market',
          size: calculatedSize.toString()
        };
        
        logger.info(`📝 Placing BUY order: ${symbol} size=${calculatedSize} @ ~$${price}`);
        
        const order = await this.makeRequest('POST', '/api/v1/orders', JSON.stringify(orderParams));
        
        this.positions.set(symbol, { size: calculatedSize, entryPrice: price, timestamp: Date.now() });
        this.tradesExecuted++;
        
        logger.info(`✅ BUY ${symbol}: ${calculatedSize} @ $${price.toFixed(2)} (Value: $${(calculatedSize * price).toFixed(2)})`);
        logger.info(`   Order ID: ${order.orderId}`);
        
      } else if (side === 'sell') {
        const position = this.positions.get(symbol);
        if (!position) {
          logger.warn(`❌ No position in ${symbol} to sell`);
          return;
        }
        
        // Create sell order
        const orderParams = {
          clientOid: `bot-${symbol}-${Date.now()}`,
          side: 'sell',
          symbol: symbol,
          type: 'market',
          size: position.size.toString()
        };
        
        logger.info(`📝 Placing SELL order: ${symbol} size=${position.size}`);
        
        const order = await this.makeRequest('POST', '/api/v1/orders', JSON.stringify(orderParams));
        
        const profit = (price - position.entryPrice) * position.size;
        this.profit += profit;
        this.positions.delete(symbol);
        this.tradesExecuted++;
        
        const profitPct = ((price - position.entryPrice) / position.entryPrice) * 100;
        logger.info(`✅ SELL ${symbol}: ${position.size} @ $${price.toFixed(2)} (P&L: $${profit.toFixed(2)} / ${profitPct.toFixed(2)}%)`);
        logger.info(`   Order ID: ${order.orderId}`);
      }
      
    } catch (error) {
      logger.error(`❌ Trade execution failed: ${error.message}`);
    }
  }

  async printPortfolioSummary() {
    try {
      const accounts = await this.makeRequest('GET', '/api/v1/accounts');
      const usdtAccount = accounts.find(acc => acc.currency === 'USDT' && acc.type === 'trade');
      
      logger.info(`\n💰 Portfolio Summary:`);
      if (usdtAccount) {
        logger.info(`   USDT Balance: ${usdtAccount.available}`);
      }
      logger.info(`   Total Profit: $${this.profit.toFixed(2)}`);
      logger.info(`   Trades Executed: ${this.tradesExecuted}`);
      logger.info(`   Active Positions: ${this.positions.size}`);
      
      if (this.positions.size > 0) {
        this.positions.forEach((pos, symbol) => {
          logger.info(`      ${symbol}: ${pos.size} @ $${pos.entryPrice.toFixed(2)}`);
        });
      }
      
    } catch (error) {
      logger.error(`Error fetching portfolio: ${error.message}`);
    }
  }

  async stop() {
    logger.info('🛑 Stopping live trading bot...');
    this.isRunning = false;
    logger.info('✅ Live trading bot stopped');
  }
}

// Main execution
const bot = new LiveTradingBot();

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

module.exports = LiveTradingBot;