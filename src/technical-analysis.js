/**
 * Technical Analysis Engine
 * Combines indicators from both original bots
 */

const technicalindicators = require('technicalindicators');
const tulind = require('tulind');

class TechnicalAnalysis {
  constructor() {
    this.indicators = ['rsi', 'macd', 'bollinger', 'ema', 'volume'];
  }

  async analyze(marketData) {
    const closes = marketData.klines.map(k => k.close);
    const highs = marketData.klines.map(k => k.high);
    const lows = marketData.klines.map(k => k.low);
    const volumes = marketData.klines.map(k => k.volume);

    try {
      const results = await Promise.all([
        this.calculateRSI(closes),
        this.calculateMACD(closes),
        this.calculateBollingerBands(closes),
        this.calculateEMA(closes),
        this.calculateVolumeAnalysis(volumes, closes),
        this.calculateATR(highs, lows, closes)
      ]);

      return {
        rsi: results[0],
        macd: results[1],
        bollingerBands: results[2],
        ema: results[3],
        volume: results[4],
        atr: results[5],
        price: marketData.price,
        change24h: marketData.change24h
      };
    } catch (error) {
      throw new Error(`Technical analysis failed: ${error.message}`);
    }
  }

  async calculateRSI(prices, period = 14) {
    try {
      const input = { values: prices, period: period };
      const rsiValues = await technicalindicators.RSI.calculate(input);
      return rsiValues[rsiValues.length - 1];
    } catch (error) {
      return 50; // Default neutral RSI
    }
  }

  async calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    try {
      const input = {
        values: prices,
        fastPeriod: fastPeriod,
        slowPeriod: slowPeriod,
        signalPeriod: signalPeriod,
        SimpleMAOscillator: false,
        SimpleMASignal: false
      };
      const macdData = await technicalindicators.MACD.calculate(input);
      const latest = macdData[macdData.length - 1];
      return {
        macd: latest.MACD,
        signal: latest.signal,
        histogram: latest.histogram
      };
    } catch (error) {
      return { macd: 0, signal: 0, histogram: 0 };
    }
  }

  async calculateBollingerBands(prices, period = 20, stdDev = 2) {
    try {
      const input = {
        values: prices,
        period: period,
        stdDev: stdDev
      };
      const bbData = await technicalindicators.BollingerBands.calculate(input);
      const latest = bbData[bbData.length - 1];
      return {
        middle: latest.middle,
        upper: latest.upper,
        lower: latest.lower,
        pb: (prices[prices.length - 1] - latest.lower) / (latest.upper - latest.lower) // Position within bands
      };
    } catch (error) {
      return { middle: 0, upper: 0, lower: 0, pb: 0.5 };
    }
  }

  async calculateEMA(prices, period = 20) {
    try {
      const input = { values: prices, period: period };
      const emaValues = await technicalindicators.EMA.calculate(input);
      return emaValues[emaValues.length - 1];
    } catch (error) {
      return prices[prices.length - 1];
    }
  }

  async calculateVolumeAnalysis(volumes, prices) {
    try {
      const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const currentVolume = volumes[volumes.length - 1];
      const volumeRatio = currentVolume / avgVolume;

      // Price-volume analysis
      const priceChange = (prices[prices.length - 1] - prices[prices.length - 2]) / prices[prices.length - 2];
      const volumeChange = (volumes[volumes.length - 1] - volumes[volumes.length - 2]) / volumes[volumes.length - 2];

      return {
        current: currentVolume,
        average: avgVolume,
        ratio: volumeRatio,
        priceVolumeTrend: this.getPriceVolumeTrend(priceChange, volumeChange)
      };
    } catch (error) {
      return { current: 0, average: 0, ratio: 1, priceVolumeTrend: 'neutral' };
    }
  }

  getPriceVolumeTrend(priceChange, volumeChange) {
    if (priceChange > 0 && volumeChange > 0) return 'bullish_confirmation';
    if (priceChange > 0 && volumeChange < 0) return 'bullish_divergence';
    if (priceChange < 0 && volumeChange > 0) return 'bearish_confirmation';
    if (priceChange < 0 && volumeChange < 0) return 'bearish_divergence';
    return 'neutral';
  }

  async calculateATR(highs, lows, closes, period = 14) {
    try {
      const input = {
        high: highs,
        low: lows,
        close: closes,
        period: period
      };
      const atrValues = await tulind.indicators.atr.indicator(input);
      return atrValues[0][atrValues[0].length - 1];
    } catch (error) {
      return 0;
    }
  }

  async getTradingSignals(indicators) {
    const signals = [];

    // RSI signals
    if (indicators.rsi < 30) signals.push({ type: 'oversold', strength: 'strong' });
    if (indicators.rsi > 70) signals.push({ type: 'overbought', strength: 'strong' });
    if (indicators.rsi < 40) signals.push({ type: 'oversold', strength: 'moderate' });
    if (indicators.rsi > 60) signals.push({ type: 'overbought', strength: 'moderate' });

    // MACD signals
    if (indicators.macd.histogram > 0 && indicators.macd.macd > indicators.macd.signal) {
      signals.push({ type: 'bullish_momentum', strength: 'moderate' });
    }
    if (indicators.macd.histogram < 0 && indicators.macd.macd < indicators.macd.signal) {
      signals.push({ type: 'bearish_momentum', strength: 'moderate' });
    }

    // Bollinger Bands signals
    if (indicators.bollingerBands.pb < 0.2) signals.push({ type: 'oversold_bb', strength: 'strong' });
    if (indicators.bollingerBands.pb > 0.8) signals.push({ type: 'overbought_bb', strength: 'strong' });

    // Volume signals
    if (indicators.volume.ratio > 1.5 && indicators.volume.priceVolumeTrend === 'bullish_confirmation') {
      signals.push({ type: 'volume_breakout', strength: 'strong' });
    }

    return signals;
  }

  getOverallSentiment(indicators) {
    let bullishScore = 0;
    let bearishScore = 0;

    // RSI scoring
    if (indicators.rsi < 30) bullishScore += 2;
    else if (indicators.rsi < 40) bullishScore += 1;
    else if (indicators.rsi > 70) bearishScore += 2;
    else if (indicators.rsi > 60) bearishScore += 1;

    // MACD scoring
    if (indicators.macd.histogram > 0) bullishScore += 1;
    else bearishScore += 1;

    // Bollinger Bands scoring
    if (indicators.bollingerBands.pb < 0.3) bullishScore += 1;
    else if (indicators.bollingerBands.pb > 0.7) bearishScore += 1;

    // Volume scoring
    if (indicators.volume.priceVolumeTrend === 'bullish_confirmation') bullishScore += 1;
    else if (indicators.volume.priceVolumeTrend === 'bearish_confirmation') bearishScore += 1;

    if (bullishScore > bearishScore + 1) return 'bullish';
    if (bearishScore > bullishScore + 1) return 'bearish';
    return 'neutral';
  }
}

module.exports = TechnicalAnalysis;