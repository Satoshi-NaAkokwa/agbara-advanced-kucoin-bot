/**
 * KuCoin API Client
 * Handles all interactions with KuCoin's trading API
 */

const crypto = require('crypto');
const https = require('https');

class KuCoinClient {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.secretKey = config.secretKey;
        this.passphrase = config.passphrase;
        this.baseUrl = config.sandbox ? 'api-sandbox.kucoin.com' : 'api.kucoin.com';
        this.futuresUrl = config.sandbox ? 'api-futures-sandbox.kucoin.com' : 'api-futures.kucoin.com';
    }

    /**
     * Generate API signature
     */
    sign(timestamp, method, endpoint, body = '') {
        const message = timestamp + method + endpoint + body;
        const hmac = crypto.createHmac('sha256', this.secretKey);
        hmac.update(message);
        return hmac.digest('base64');
    }

    /**
     * Make authenticated API request
     */
    request(endpoint, method = 'GET', params = {}, useFutures = false) {
        return new Promise((resolve, reject) => {
            const timestamp = Date.now().toString();
            let pathStr = endpoint;
            let body = '';

            if (method === 'GET' && Object.keys(params).length > 0) {
                pathStr += '?' + new URLSearchParams(params).toString();
            } else if ((method === 'POST' || method === 'DELETE') && Object.keys(params).length > 0) {
                body = JSON.stringify(params);
            }

            const signature = this.sign(timestamp, method, pathStr, body);
            const baseUrl = useFutures ? this.futuresUrl : this.baseUrl;

            const options = {
                hostname: baseUrl,
                port: 443,
                path: pathStr,
                method: method,
                headers: {
                    'KC-API-KEY': this.apiKey,
                    'KC-API-SIGN': signature,
                    'KC-API-TIMESTAMP': timestamp,
                    'KC-API-PASSPHRASE': this.passphrase,
                    'Content-Type': 'application/json',
                    'KC-API-KEY-VERSION': '2'
                }
            };

            const req = https.request(options, res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.code && json.code !== '200000') {
                            reject(new Error(`KuCoin API Error: ${json.msg || json.message} (Code: ${json.code})`));
                        } else {
                            resolve(json.data || json);
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${e.message}`));
                    }
                });
            });

            req.on('error', reject);
            if (body) req.write(body);
            req.end();
        });
    }

    /**
     * Public API request (no authentication)
     */
    publicRequest(endpoint, params = {}, useFutures = false) {
        return new Promise((resolve, reject) => {
            const baseUrl = useFutures ? this.futuresUrl : this.baseUrl;
            let pathStr = endpoint;

            if (Object.keys(params).length > 0) {
                pathStr += '?' + new URLSearchParams(params).toString();
            }

            const options = {
                hostname: baseUrl,
                port: 443,
                path: pathStr,
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const req = https.request(options, res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.code && json.code !== '200000') {
                            reject(new Error(`KuCoin API Error: ${json.msg || json.message}`));
                        } else {
                            resolve(json.data || json);
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${e.message}`));
                    }
                });
            });

            req.on('error', reject);
            req.end();
        });
    }

    // Account methods
    async getAccounts() {
        return this.request('/api/v1/accounts');
    }

    async getAccountBalance(currency = 'USDT') {
        const accounts = await this.getAccounts();
        return accounts.find(acc => acc.currency === currency && acc.type === 'trade');
    }

    // Market data methods
    async getTicker(symbol) {
        return this.publicRequest(`/api/v1/market/orderbook/level1?symbol=${symbol}`);
    }

    async getKlines(symbol, interval = '1hour', startAt = null, endAt = null) {
        let params = { symbol, type: interval };
        if (startAt) params.startAt = startAt;
        if (endAt) params.endAt = endAt;
        return this.publicRequest('/api/v1/market/candles', params);
    }

    // Order methods
    async placeOrder(params) {
        return this.request('/api/v1/orders', 'POST', params);
    }

    async cancelOrder(orderId) {
        return this.request(`/api/v1/orders/${orderId}`, 'DELETE');
    }

    async getOrders(symbol, status = 'active') {
        return this.request('/api/v1/orders', 'GET', { symbol, status });
    }

    // Futures methods
    async getFuturesPosition(symbol) {
        return this.request(`/api/v1/position?symbol=${symbol}`, 'GET', {}, true);
    }

    async placeFuturesOrder(params) {
        return this.request('/api/v1/orders', 'POST', params, true);
    }
}

module.exports = KuCoinClient;