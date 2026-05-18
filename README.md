# Agbara Advanced KuCoin Trading Bot 🚀

An intelligent 24/7 autonomous KuCoin trading bot with local LLM integration - merged from `kucoin-profit-bot` and `agbara-kucoin-trading-bot`.

## 🌟 Features

### Core Capabilities
- 🤖 **Local LLM Integration** - Uses local LLM for intelligent trading decisions
- 📊 **Multi-Strategy Trading** - Scalping, Momentum, Arbitrage, Moonshot strategies
- 🛡️ **Advanced Risk Management** - Position sizing, stop-loss, daily limits
- ⚡ **24/7 Autonomous Operation** - Dockerized for continuous trading
- 📈 **Real-Time Market Analysis** - Technical indicators + AI-powered insights

### Trading Strategies
1. **Scalping** (25% weight) - Quick trades on small price movements
2. **Momentum** (35% weight) - Trend-following with MACD/EMA
3. **Arbitrage** (20% weight) - Cross-exchange opportunities
4. **Moonshot** (20% weight) - High-risk, high-reward explosive moves

### Technical Indicators
- RSI (Relative Strength Index)
- MACD (Moving Average Convergence Divergence)
- Bollinger Bands
- EMA (Exponential Moving Average)
- ATR (Average True Range)
- Volume Analysis

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- KuCoin API credentials
- Local LLM (Ollama recommended)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Satoshi-NaAkokwa/agbara-advanced-kucoin-bot.git
cd agbara-advanced-kucoin-bot
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your KuCoin API credentials and LLM endpoint
```

4. **Run with Docker (Recommended for 24/7)**
```bash
docker-compose up -d
```

5. **Run locally (Development)**
```bash
npm start
```

## ⚙️ Configuration

### Environment Variables

```bash
# KuCoin API Credentials
KUCOIN_API_KEY=your_api_key
KUCOIN_SECRET_KEY=your_secret_key
KUCOIN_API_PASSPHRASE=your_passphrase

# Local LLM Configuration
LLM_ENDPOINT=http://localhost:11434/api/generate
LLM_MODEL=llama2
LLM_TIMEOUT=30000

# Trading Configuration
MAX_POSITION_SIZE=1000
RISK_PER_TRADE=0.02
MAX_DAILY_LOSS=500
TRADING_PAIRS=BTC-USDT,ETH-USDT,SOL-USDT

# Risk Management
STOP_LOSS_PCT=0.02
TAKE_PROFIT_PCT=0.05
MAX_DAILY_TRADES=50

# Telegram Notifications
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

## 📊 Architecture

```
agbara-advanced-kucoin-bot/
├── src/
│   ├── core/
│   │   └── kucoin-connector.js    # KuCoin API wrapper
│   ├── llm-client.js              # Local LLM integration
│   ├── risk-manager.js            # Advanced risk management
│   ├── technical-analysis.js      # Technical indicators
│   └── strategy-engine.js         # Multi-strategy engine
├── index.js                       # Main bot entry point
├── Dockerfile                     # Docker configuration
├── docker-compose.yml             # Docker Compose setup
└── package.json                   # Dependencies
```

## 🧠 Local LLM Integration

The bot uses your local LLM for intelligent trading decisions:

### Setup Ollama (Recommended)
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama2

# Start Ollama server
ollama serve
```

### LLM Decision Process
1. **Market Analysis** - Analyzes technical indicators and market data
2. **Signal Generation** - Provides BUY/SELL/HOLD recommendations
3. **Confidence Scoring** - Rates decision confidence (0.0-1.0)
4. **Reasoning** - Explains the logic behind each decision

### Fallback Mechanism
If LLM is unavailable, the bot automatically falls back to rule-based trading strategies.

## 🛡️ Risk Management

### Multi-Layer Protection
- **Position Size Limits** - Maximum $1000 per position
- **Daily Loss Limits** - Stops trading after $500 daily loss
- **Risk Per Trade** - Maximum 2% of capital per trade
- **Stop-Loss/Take-Profit** - Automatic exit at 2% loss / 5% profit
- **Trade Frequency Limits** - Maximum 50 trades per day

### Portfolio Protection
- Dynamic position sizing based on confidence
- Automatic position monitoring and exit
- Daily risk counter reset at midnight
- Real-time P&L tracking

## 📈 Trading Process

1. **Market Data Collection** - Real-time price and volume data
2. **Technical Analysis** - Calculate indicators (RSI, MACD, etc.)
3. **Strategy Evaluation** - Execute all 4 trading strategies
4. **LLM Decision** - Get AI-powered trading recommendation
5. **Signal Combination** - Weighted combination of strategies + LLM
6. **Risk Assessment** - Validate against risk management rules
7. **Trade Execution** - Place orders via KuCoin API
8. **Position Monitoring** - Track open positions and exit conditions
9. **Notification** - Send Telegram alerts for trades and errors

## 🐳 Docker Deployment

### Build and Run
```bash
# Build the Docker image
docker build -t agbara-kucoin-bot .

# Run with Docker Compose (Recommended)
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop the bot
docker-compose down
```

### Docker Features
- **Auto-restart** - `restart: unless-stopped` ensures 24/7 operation
- **Health checks** - Monitors bot health every 30 seconds
- **Resource limits** - CPU and memory constraints
- **Log rotation** - Automatic log file management
- **Volume mounting** - Persistent logs and models

## 📱 Notifications

### Telegram Integration
The bot sends real-time notifications via Telegram:

- **Trade Executed** - When a trade is placed
- **Trade Errors** - When trade execution fails
- **Daily Summary** - End-of-day trading summary
- **System Alerts** - Bot health and status updates

### Configure Telegram
1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Get your bot token
3. Start a conversation with your bot
4. Get your chat ID via [@userinfobot](https://t.me/userinfobot)
5. Add credentials to `.env`

## 🔍 Monitoring

### Check Bot Status
```bash
# View logs
docker-compose logs -f kucoin-bot

# Check container status
docker ps | grep agbara-kucoin-bot

# Health check
docker inspect agbara-kucoin-bot | grep -A 10 Health
```

### Log Files
- `logs/bot.log` - Main bot activity log
- `logs/llm-integration.log` - LLM decision logs
- `logs/risk-manager.log` - Risk management logs

## 🧪 Testing

### Test API Connection
```bash
npm test
```

### Backtesting
```bash
npm run backtest
```

### Manual Trade
```bash
npm run manual-trade
```

## 🔄 Updating

### Pull Latest Changes
```bash
git pull origin main
docker-compose down
docker-compose up -d --build
```

### Update Dependencies
```bash
npm update
docker-compose build --no-cache
docker-compose up -d
```

## 🛠️ Troubleshooting

### Bot Not Starting
1. Check environment variables in `.env`
2. Verify KuCoin API credentials
3. Ensure LLM endpoint is accessible
4. Check Docker logs: `docker-compose logs`

### Trades Not Executing
1. Verify risk management limits
2. Check daily trade counters
3. Ensure sufficient account balance
4. Review confidence thresholds

### LLM Connection Issues
1. Verify LLM endpoint is running
2. Check firewall settings
3. Bot will automatically fall back to rule-based trading

## 📊 Performance Metrics

The bot tracks:
- Daily P&L
- Win rate
- Average trade duration
- Risk-adjusted returns
- Strategy performance

## 🔒 Security

- Credentials stored in environment variables (never in code)
- Non-root Docker user
- Rate limiting on API calls
- Input validation and sanitization
- Error handling and logging

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## ⚠️ Disclaimer

**TRADING CRYPTOCURRENCIES INVOLVES SUBSTANTIAL RISK OF LOSS**

This software is provided "AS IS" without warranty of any kind. The authors assume no liability for any damages or losses arising from the use of this software. Past performance does not guarantee future results.

**ALWAYS:**
- Start with small amounts
- Understand the risks
- Never invest more than you can afford to lose
- Monitor the bot regularly
- Keep credentials secure

## 📞 Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/Satoshi-NaAkokwa/agbara-advanced-kucoin-bot/issues)
- Telegram: @Agbara_AI_bot

---

**Built by Agbara for Agbara-Okenze** 🚀

*Merged from kucoin-profit-bot and agbara-kucoin-trading-bot with local LLM integration*