/**
 * Local LLM Integration for Intelligent Trading Decisions
 * Connects to local LLM (Ollama) for market analysis and trade signals
 */

const axios = require('axios');
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
    new winston.transports.File({ filename: 'logs/llm-integration.log' })
  ]
});

class LocalLLMClient {
  constructor(config = {}) {
    this.endpoint = config.endpoint || process.env.LLM_ENDPOINT || 'http://localhost:11434/api/generate';
    this.model = config.model || process.env.LLM_MODEL || 'llama2';
    this.timeout = config.timeout || parseInt(process.env.LLM_TIMEOUT) || 30000;
    this.enabled = config.enabled !== false;
  }

  async generateTradingSignal(marketData) {
    if (!this.enabled) {
      logger.warn('LLM integration disabled, using rule-based fallback');
      return this.getFallbackSignal(marketData);
    }

    const prompt = this.buildPrompt(marketData);
    
    try {
      const response = await axios.post(this.endpoint, {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 500
        }
      }, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = this.parseLLMResponse(response.data.response);
      logger.info(`LLM decision for ${marketData.symbol}: ${result.action} (confidence: ${result.confidence})`);
      return result;

    } catch (error) {
      logger.error(`LLM request failed: ${error.message}`);
      return this.getFallbackSignal(marketData);
    }
  }

  buildPrompt(marketData) {
    const { symbol, price, indicators, marketSummary, riskAssessment } = marketData;
    
    return `
You are an expert cryptocurrency trading analyst. Analyze the following market data and provide a trading decision.

**Symbol:** ${symbol}
**Current Price:** ${price}

**Technical Indicators:**
- RSI (14): ${indicators.rsi}
- MACD: ${indicators.macd}
- Bollinger Bands: ${indicators.bollingerBands}
- Volume: ${indicators.volume}
- 24h Change: ${indicators.change24h}%

**Market Summary:**
${marketSummary}

**Risk Assessment:**
${riskAssessment}

Based on your analysis, provide a trading decision in the following format:
ACTION: [BUY/SELL/HOLD]
CONFIDENCE: [0.0-1.0]
REASONING: [brief explanation in 1-2 sentences]

Consider:
1. Technical indicator signals
2. Market sentiment and trends
3. Risk-reward ratio
4. Current market conditions

Provide your decision now:`;
  }

  parseLLMResponse(response) {
    try {
      const actionMatch = response.match(/ACTION:\s*(BUY|SELL|HOLD)/i);
      const confidenceMatch = response.match(/CONFIDENCE:\s*([0-9.]+)/i);
      const reasoningMatch = response.match(/REASONING:\s*(.+?)(?:\n|$)/i);

      const action = actionMatch ? actionMatch[1].toUpperCase() : 'HOLD';
      const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;
      const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'No reasoning provided';

      return { action, confidence: Math.min(Math.max(confidence, 0), 1), reasoning };
    } catch (error) {
      logger.error(`Failed to parse LLM response: ${error.message}`);
      return { action: 'HOLD', confidence: 0.5, reasoning: 'Parsing error, using hold' };
    }
  }

  async getMarketAnalysis(marketData) {
    if (!this.enabled) return null;

    const prompt = `Analyze the cryptocurrency market conditions and provide insights.

**Current Market Data:**
${JSON.stringify(marketData, null, 2)}

Provide a brief market analysis covering:
1. Overall market trend
2. Key support/resistance levels
3. Potential risks and opportunities
4. Recommended trading approach

Keep it concise and actionable:`;

    try {
      const response = await axios.post(this.endpoint, {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: { max_tokens: 300 }
      }, { timeout: this.timeout });

      return response.data.response;
    } catch (error) {
      logger.error(`Market analysis request failed: ${error.message}`);
      return null;
    }
  }

  getFallbackSignal(marketData) {
    const { indicators } = marketData;
    
    if (indicators.rsi < 30 && indicators.change24h < -2) {
      return { action: 'BUY', confidence: 0.6, reasoning: 'RSI oversold, price dropped significantly' };
    } else if (indicators.rsi > 70 && indicators.change24h > 2) {
      return { action: 'SELL', confidence: 0.6, reasoning: 'RSI overbought, price increased significantly' };
    } else {
      return { action: 'HOLD', confidence: 0.7, reasoning: 'Market conditions neutral, waiting for better setup' };
    }
  }

  async healthCheck() {
    try {
      const response = await axios.post(this.endpoint, {
        model: this.model,
        prompt: 'Test',
        stream: false
      }, { timeout: 5000 });
      return { healthy: true, latency: response.headers['x-process-time'] || 'unknown' };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

module.exports = LocalLLMClient;