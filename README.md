# 🤖 Smart Trading Bot v4.0 - Professional Grade

[![Version](https://img.shields.io/badge/version-4.0.0-blue.svg)](https://github.com/Satoshi-NaAkokwa/agbara-advanced-kucoin-bot)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)

A professional-grade cryptocurrency trading bot for KuCoin with **proper stop-loss/take-profit execution**, **real profit tracking**, **LLM-powered sentiment analysis**, **multi-asset portfolio management**, and **intelligent exit strategies**.

## 🌟 NEW in v4.0

### ✅ Proper Stop-Loss/Take-Profit Execution
- Dynamic stop-loss based on ATR (Average True Range)
- Trailing stops that lock in profits as price moves up
- Risk-reward ratio minimum of 2:1 for every trade
- Automatic position management with exit strategies

### ✅ Real Profit Tracking & Machine Learning
- Actual PnL calculated for every trade
- Win rate tracking per strategy
- Automatic strategy weight adjustment based on performance
- Learning from both winning and losing trades

### ✅ LLM-Powered Sentiment Analysis
- Integration with local LLM (Ollama/Llama2)
- Market sentiment classification (Very Bullish → Very Bearish)
- Fear/Greed Index calculation
- Sentiment-adjusted confidence scoring

### ✅ Multi-Asset Portfolio Management
- 4 strategy categories with different trading pairs
- Dynamic capital allocation per strategy
- Portfolio rebalancing based on performance
- Maximum 10 concurrent positions

### ✅ Intelligent Exit Strategies
- Stop-loss triggers
- Take-profit triggers
- Trailing stop activation
- Time-based exits for profitable positions

### 🧠 Core Features
- 📊 **Technical Analysis**: RSI, MACD, Bollinger Bands, SMA, EMA, ATR
- 🔄 **Adaptive Strategies**: Automatically adjusts based on performance
- 🎯 **Multi-Strategy Approach**: Momentum, Scalping, Mean Reversion, Moonshot
- 💰 **Fee-Aware Trading**: Only enters trades that can cover fees profitably

### Technical Analysis
- 📈 **RSI (Relative Strength Index)**: Identifies overbought/oversold conditions
- 📉 **MACD (Moving Average Convergence Divergence)**: Detects trend changes
- 📊 **SMA/EMA (Simple/Exponential Moving Averages)**: Trend identification
- 📏 **Bollinger Bands**: Volatility and price level analysis
- 📊 **Volume Analysis**: Confirms price movements

### Risk Management
- 💰 **Position Sizing**: Dynamic based on confidence and portfolio
- 🛡️ **Stop Loss/Take Profit**: Automatic risk management
- 📉 **Daily Loss Limits**: Prevents excessive losses
- 🔢 **Trade Frequency Limits**: Controls trading activity

### Self-Learning Capabilities
- 📚 **Trade History Analysis**: Learns from successful and failed trades
- 🎓 **Pattern Database**: Builds a database of successful patterns
- ⚖️ **Strategy Adaptation**: Adjusts strategy weights based on performance
- 🧪 **Continuous Improvement**: Gets smarter with each trade

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- KuCoin Account with API access
- (Optional) Local LLM for enhanced decision-making

### Installation

```bash
# Clone the repository
git clone https://github.com/Satoshi-NaAkokwa/agbara-advanced-kucoin-bot.git
cd agbara-advanced-kucoin-bot

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your KuCoin API credentials

# Start the bot
npm start
```

### Configuration

Edit the `.env` file with your settings:

```bash
# KuCoin API Credentials
KUCOIN_API_KEY=your_api_key
KUCOIN_SECRET_KEY=your_secret_key
KUCOIN_API_PASSPHRASE=your_passphrase

# Trading Configuration
MAX_POSITION_SIZE=50
RISK_PER_TRADE=0.02
MAX_DAILY_LOSS=100

# Self-Learning
LEARNING_ENABLED=true
ADAPTIVE_STRATEGIES=true
PATTERN_RECOGNITION=true
```

## 📊 Trading Strategies

### 1. Momentum Strategy (30% weight)
- Follows market trends using MACD and moving averages
- Buys on bullish momentum with RSI 50-70
- Sells on bearish momentum with RSI 30-50
- Adapts based on historical performance

### 2. Mean Reversion Strategy (25% weight)
- Identifies overbought/oversold conditions
- Buys when RSI < 30 (oversold)
- Sells when RSI > 70 (overbought)
- Capitalizes on price reversals

### 3. Scalping Strategy (25% weight)
- Quick trades on volume spikes
- Exploits short-term price movements
- Uses volume analysis for confirmation
- High frequency, small profit targets

### 4. Pattern Recognition Strategy (20% weight)
- Learns from historical patterns
- Matches current conditions to past successful trades
- Builds database of profitable patterns
- Improves over time through learning

## 🧠 Self-Learning System

### How It Works

1. **Trade Recording**: Every trade is recorded with:
   - Market conditions (RSI, trend, volume)
   - Strategy used
   - Confidence level
   - Outcome (profit/loss)

2. **Pattern Recognition**:
   - Identifies recurring market patterns
   - Stores successful patterns with success rates
   - Matches current conditions to historical patterns

3. **Strategy Adaptation**:
   - Tracks performance of each strategy
   - Adjusts weights based on success rates
   - Automatically rebalances strategy importance

4. **Continuous Improvement**:
   - Learns from mistakes
   - Refines successful approaches
   - Builds knowledge over time

### Learning Data

The bot stores learning data in `learning-data.json`:
```json
{
  "tradeHistory": [...],
  "patterns": [...],
  "strategies": {...},
  "lastSaved": 1234567890
}
```

## 🔧 Advanced Configuration

### Risk Management

```bash
# Position Sizing
MAX_POSITION_SIZE=50          # Maximum USDT per trade
RISK_PER_TRADE=0.02          # 2% risk per trade

# Limits
MAX_DAILY_LOSS=100           # Stop trading after $100 loss
MAX_DAILY_TRADES=30          # Maximum 30 trades per day
MAX_TRADES_PER_PAIR=5        # Maximum 5 trades per pair

# Stop Loss/Take Profit
STOP_LOSS_PCT=0.02           # 2% stop loss
TAKE_PROFIT_PERCENT=5.0      # 5% take profit
```

### Strategy Configuration

```bash
# Strategy Selection
STRATEGY=intelligent          # Options: hybrid, intelligent, momentum, scalping

# Confidence Threshold
MIN_CONFIDENCE=0.75          # Minimum 75% confidence to trade

# Strategy Weights (should sum to 1.0)
SCALPING_SIZE=0.10           # 10% allocation
MOMENTUM_SIZE=0.15           # 15% allocation
ARBITRAGE_SIZE=0.20          # 20% allocation
MOONSHOT_SIZE=0.05           # 5% allocation
```

### Trading Pairs

```bash
# Main pairs
TRADING_PAIRS=BTC-USDT,ETH-USDT,SOL-USDT

# Strategy-specific pairs
SCALPING_PAIRS=SOL-USDT,DOGE-USDT,PEPE-USDT,WIF-USDT,BONK-USDT
MOMENTUM_PAIRS=BTC-USDT,ETH-USDT,SOL-USDT,XRP-USDT
ARBITRAGE_PAIRS=BTC-USDT,ETH-USDT,SOL-USDT
MOONSHOT_PAIRS=PEPE-USDT,WIF-USDT,BONK-USDT,FLOKI-USDT,SHIB-USDT
```

## 📈 Performance Monitoring

### Logs

The bot generates detailed logs in `logs/intelligent-bot.log`:

```
2026-05-18 16:51:30 [INFO] 🤖 Starting Intelligent Self-Learning Trading Bot
2026-05-18 16:51:30 [INFO] 💵 Total Portfolio Value: $9.68
2026-05-18 16:51:30 [INFO] 📊 Strategies initialized
2026-05-18 16:51:30 [INFO] 🔄 Trading Cycle #1
```

### PM2 Monitoring

```bash
# View real-time logs
pm2 logs agbara-intelligent-bot

# Monitor resource usage
pm2 monit

# Check status
pm2 status
```

### Telegram Notifications

Enable Telegram notifications for:
- Trade executions
- Error alerts
- Daily summaries
- Portfolio updates

## 🛡️ Security

### Best Practices

1. **API Keys**:
   - Never commit `.env` file to git
   - Use API keys with limited permissions
   - Enable IP whitelist on KuCoin
   - Regularly rotate keys

2. **Position Sizing**:
   - Start with small amounts
   - Test in simulation mode first
   - Gradually increase as bot proves itself

3. **Risk Management**:
   - Set appropriate daily loss limits
   - Monitor bot performance regularly
   - Have an emergency stop plan

### .gitignore

The repository includes comprehensive `.gitignore`:
```
.env
.env.local
node_modules/
logs/
*.log
learning-data.json
```

## 📦 Deployment

### Local Deployment with PM2

```bash
# Install PM2
npm install -g pm2

# Start bot
pm2 start intelligent-bot.js --name "agbara-intelligent-bot"

# Save PM2 configuration
pm2 save

# Setup auto-start on boot
pm2 startup
```

### Docker Deployment

```bash
# Build image
docker build -t agbara-kucoin-bot .

# Run container
docker run -d \
  --name kucoin-bot \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  agbara-kucoin-bot

# Or use docker-compose
docker-compose up -d
```

## 🧪 Testing

### Test API Connection

```bash
node test-api.js
```

### Run in Simulation Mode

Set in `.env`:
```bash
NODE_ENV=development
```

### Backtest Strategies

```bash
npm run backtest
```

## 📊 Architecture

```
agbara-advanced-kucoin-bot/
├── intelligent-bot.js          # Main self-learning bot
├── live-bot.js                 # Basic live trading bot
├── simulate-bot.js             # Simulation mode bot
├── src/
│   ├── core/
│   │   └── kucoin-connector.js # KuCoin API wrapper
│   ├── llm-client.js           # Local LLM integration
│   ├── risk-manager.js         # Risk management
│   ├── technical-analysis.js   # Technical indicators
│   └── strategy-engine.js      # Strategy execution
├── logs/                       # Log files
├── learning-data.json          # Self-learning data
├── .env                        # Configuration (not in git)
├── .env.example                # Configuration template
└── package.json                # Dependencies
```

## 🔄 How It Works

### Trading Cycle

1. **Market Analysis**:
   - Fetch current prices and klines
   - Calculate technical indicators
   - Determine market trends

2. **Signal Generation**:
   - Each strategy analyzes market data
   - Generates buy/sell signals with confidence
   - Signals combined with weighted voting

3. **Trade Execution**:
   - Calculate position size based on confidence
   - Check risk management rules
   - Execute trade if all checks pass

4. **Learning**:
   - Record trade details
   - Analyze outcomes
   - Update strategy weights
   - Store successful patterns

### Adaptive Weight Adjustment

The bot continuously adjusts strategy weights based on performance:

```
Initial:     Momentum 30%, Scalping 25%, Mean Reversion 25%, Pattern 20%
After 100 trades: Momentum 35%, Scalping 20%, Mean Reversion 30%, Pattern 15%
```

## 🐛 Troubleshooting

### Common Issues

1. **API Connection Failed**
   ```
   Solution: Check API keys and permissions
   Verify IP whitelist on KuCoin
   ```

2. **Insufficient Balance**
   ```
   Solution: Ensure minimum USDT balance
   Adjust MAX_POSITION_SIZE in .env
   ```

3. **Invalid Order Size**
   ```
   Solution: Check KuCoin minimum order requirements
   Increase position size or add funds
   ```

4. **Learning Not Working**
   ```
   Solution: Ensure LEARNING_ENABLED=true
   Check write permissions for learning-data.json
   ```

## 📈 Performance Metrics

The bot tracks:
- Win rate per strategy
- Average profit per trade
- Maximum drawdown
- Strategy performance over time
- Pattern success rates

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

MIT License - See [LICENSE](LICENSE) file for details

## ⚠️ Disclaimer

**TRADING CRYPTOCURRENCIES INVOLVES SUBSTANTIAL RISK OF LOSS**

This software is provided "AS IS" without warranty of any kind. The authors assume no liability for any damages or losses arising from the use of this software.

**IMPORTANT:**
- Start with small amounts
- Test thoroughly before live trading
- Never invest more than you can afford to lose
- Monitor the bot regularly
- Keep credentials secure

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Satoshi-NaAkokwa/agbara-advanced-kucoin-bot/issues)
- **Telegram**: @Agbara_AI_bot
- **Documentation**: [Full Documentation](https://github.com/Satoshi-NaAkokwa/agbara-advanced-kucoin-bot/wiki)

## 🎯 Roadmap

- [ ] Enhanced LLM integration with multi-model support
- [ ] Advanced portfolio optimization
- [ ] Multi-exchange support
- [ ] Web dashboard for monitoring
- [ ] Advanced backtesting system
- [ ] Machine learning models for prediction
- [ ] Social trading features

---

**Built by Agbara** 🤖

*Intelligent, Self-Learning, Profitable*

*Version 3.0.0 - The Future of Automated Trading*