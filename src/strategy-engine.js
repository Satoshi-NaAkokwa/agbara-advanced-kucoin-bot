/**
 * Multi-Strategy Engine
 * Combines strategies from both original bots
 */

class StrategyEngine {
  constructor(config = {}) {
    this.minConfidence = config.minConfidence || 0.7;
    this.strategies = config.strategies || ['scalping', 'momentum', 'arbitrage', 'moonshot'];
    this.strategyWeights = {
      scalping: 0.25,
      momentum: 0.35,
      arbitrage: 0.20,
      moonshot: 0.20
    };
  }

  async evaluate(marketContext) {
    const { symbol, indicators, llmDecision, marketData } = marketContext;
    
    const strategyResults = await Promise.all(
      this.strategies.map(strategy => this.executeStrategy(strategy, marketContext))
    );

    const weightedSignal = this.combineSignals(strategyResults, llmDecision);
    
    return {
      ...weightedSignal,
      symbol,
      price: marketData.price,
      timestamp: Date.now()
    };
  }

  async executeStrategy(strategyName, context) {
    switch(strategyName) {
      case 'scalping':
        return this.scalpingStrategy(context);
      case 'momentum':
        return this.momentumStrategy(context);
      case 'arbitrage':
        return this.arbitrageStrategy(context);
      case 'moonshot':
        return this.moonshotStrategy(context);
      default:
        return { action: 'hold', confidence: 0, reasoning: 'Unknown strategy' };
    }
  }

  scalpingStrategy(context) {
    const { indicators, marketData } = context;
    const signals = [];

    // Quick RSI reversals
    if (indicators.rsi < 35 && indicators.change24h < -1) {
      signals.push({ action: 'buy', confidence: 0.7, reason: 'Quick RSI oversold bounce' });
    }
    if (indicators.rsi > 65 && indicators.change24h > 1) {
      signals.push({ action: 'sell', confidence: 0.7, reason: 'Quick RSI overbought pullback' });
    }

    // Volume spikes with price movement
    if (indicators.volume.ratio > 2) {
      if (indicators.change24h > 0.5) {
        signals.push({ action: 'buy', confidence: 0.75, reason: 'Volume spike with upward momentum' });
      } else if (indicators.change24h < -0.5) {
        signals.push({ action: 'sell', confidence: 0.75, reason: 'Volume spike with downward momentum' });
      }
    }

    // Bollinger Band scalping
    if (indicators.bollingerBands.pb < 0.15) {
      signals.push({ action: 'buy', confidence: 0.8, reason: 'Price at lower Bollinger Band' });
    }
    if (indicators.bollingerBands.pb > 0.85) {
      signals.push({ action: 'sell', confidence: 0.8, reason: 'Price at upper Bollinger Band' });
    }

    return this.getBestSignal(signals);
  }

  momentumStrategy(context) {
    const { indicators, marketData } = context;
    const signals = [];

    // MACD momentum
    if (indicators.macd.histogram > 0 && indicators.macd.macd > indicators.macd.signal) {
      const strength = Math.abs(indicators.macd.histogram) / indicators.macd.signal;
      signals.push({ 
        action: 'buy', 
        confidence: Math.min(0.6 + strength, 0.9), 
        reason: 'Strong bullish MACD momentum' 
      });
    }
    if (indicators.macd.histogram < 0 && indicators.macd.macd < indicators.macd.signal) {
      const strength = Math.abs(indicators.macd.histogram) / Math.abs(indicators.macd.signal);
      signals.push({ 
        action: 'sell', 
        confidence: Math.min(0.6 + strength, 0.9), 
        reason: 'Strong bearish MACD momentum' 
      });
    }

    // Trend following with EMA
    if (marketData.price > indicators.ema && indicators.change24h > 2) {
      signals.push({ action: 'buy', confidence: 0.75, reason: 'Price above EMA with strong uptrend' });
    }
    if (marketData.price < indicators.ema && indicators.change24h < -2) {
      signals.push({ action: 'sell', confidence: 0.75, reason: 'Price below EMA with strong downtrend' });
    }

    // ADX-like trend strength (using ATR)
    if (indicators.atr > indicators.price * 0.02) {
      if (indicators.change24h > 0) {
        signals.push({ action: 'buy', confidence: 0.7, reason: 'Strong uptrend with high volatility' });
      } else {
        signals.push({ action: 'sell', confidence: 0.7, reason: 'Strong downtrend with high volatility' });
      }
    }

    return this.getBestSignal(signals);
  }

  arbitrageStrategy(context) {
    const { marketData } = context;
    const signals = [];

    // Price deviations (simplified - would need multiple exchanges in real implementation)
    // For now, this is a placeholder for cross-exchange arbitrage logic
    // In a real implementation, you'd compare prices across exchanges
    
    // Funding rate arbitrage (futures)
    // Placeholder for futures funding rate analysis
    
    return { action: 'hold', confidence: 0, reason: 'No arbitrage opportunities detected' };
  }

  moonshotStrategy(context) {
    const { indicators, marketData } = context;
    const signals = [];

    // High-risk, high-reward moonshot patterns
    // Extremely oversold conditions with potential for explosive reversal
    if (indicators.rsi < 20 && indicators.change24h < -5) {
      signals.push({ 
        action: 'buy', 
        confidence: 0.85, 
        reason: 'Extreme oversold - potential moonshot reversal' 
      });
    }

    // Breakout patterns
    if (indicators.bollingerBands.pb < 0.1 && indicators.volume.ratio > 3) {
      signals.push({ 
        action: 'buy', 
        confidence: 0.8, 
        reason: 'Extreme compression with volume breakout' 
      });
    }

    // Parabolic move detection
    if (indicators.change24h > 10 && indicators.volume.ratio > 2) {
      // Check for continuation or reversal
      if (indicators.rsi < 75) {
        signals.push({ action: 'buy', confidence: 0.7, reason: 'Parabolic uptrend continuation' });
      } else {
        signals.push({ action: 'sell', confidence: 0.8, reason: 'Parabolic blow-off top' });
      }
    }

    return this.getBestSignal(signals);
  }

  getBestSignal(signals) {
    if (signals.length === 0) {
      return { action: 'hold', confidence: 0, reasoning: 'No signals generated' };
    }

    // Find the signal with highest confidence
    const bestSignal = signals.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    return {
      action: bestSignal.action,
      confidence: bestSignal.confidence,
      reasoning: bestSignal.reason
    };
  }

  combineSignals(strategyResults, llmDecision) {
    // Weight strategy signals
    let buyScore = 0;
    let sellScore = 0;
    let totalWeight = 0;

    strategyResults.forEach((result, index) => {
      const strategyName = this.strategies[index];
      const weight = this.strategyWeights[strategyName] || 0.25;

      if (result.action === 'buy') {
        buyScore += result.confidence * weight;
      } else if (result.action === 'sell') {
        sellScore += result.confidence * weight;
      }

      totalWeight += weight;
    });

    // Normalize scores
    buyScore /= totalWeight;
    sellScore /= totalWeight;

    // Incorporate LLM decision with higher weight
    const llmWeight = 0.4;
    const strategyWeight = 0.6;

    if (llmDecision.action === 'buy') {
      buyScore = buyScore * strategyWeight + llmDecision.confidence * llmWeight;
      sellScore = sellScore * strategyWeight;
    } else if (llmDecision.action === 'sell') {
      sellScore = sellScore * strategyWeight + llmDecision.confidence * llmWeight;
      buyScore = buyScore * strategyWeight;
    }

    // Final decision
    let action = 'hold';
    let confidence = 0;
    let reasoning = [];

    if (buyScore > sellScore && buyScore > this.minConfidence) {
      action = 'buy';
      confidence = buyScore;
      reasoning.push('Strategy buy signals');
      if (llmDecision.action === 'buy') reasoning.push(`LLM: ${llmDecision.reasoning}`);
    } else if (sellScore > buyScore && sellScore > this.minConfidence) {
      action = 'sell';
      confidence = sellScore;
      reasoning.push('Strategy sell signals');
      if (llmDecision.action === 'sell') reasoning.push(`LLM: ${llmDecision.reasoning}`);
    } else {
      reasoning.push('Insufficient confidence');
      if (llmDecision.action !== 'hold') reasoning.push(`LLM suggested: ${llmDecision.action}`);
    }

    // Calculate position size based on confidence
    const maxSize = parseFloat(process.env.MAX_POSITION_SIZE) || 1000;
    const size = Math.floor(maxSize * confidence);

    return {
      action,
      confidence,
      size,
      reasoning: reasoning.join('; '),
      buyScore: buyScore.toFixed(3),
      sellScore: sellScore.toFixed(3)
    };
  }

  updateStrategyWeights(performance) {
    // Dynamic strategy weight adjustment based on performance
    // This would be implemented with a feedback loop
    // For now, use static weights
  }
}

module.exports = StrategyEngine;