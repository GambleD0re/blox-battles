// backend/core/services/transactionListenerService.js
const { Alchemy, Network, AlchemySubscription } = require("alchemy-sdk");
const { ethers } = require("ethers");
const db = require('../../database/database');

const POLYGON_TOKENS = {
    'USDC': { contractAddress: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', decimals: 6 },
    'USDT': { contractAddress: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', decimals: 6 },
    'POL': { decimals: 18 },
};
const ETHEREUM_TOKENS = {
    'USDC': { contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6 },
    'USDT': { contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6 },
    'PYUSD': { contractAddress: '0x6c3ea9036406852006290770bedfcaba0e23a0e8', decimals: 6 },
    'ETH': { decimals: 18 },
};

let monitoredAddresses = new Set();
let isListenerActive = false;

async function loadMonitoredAddresses() {
    try {
        const { rows: users } = await db.query('SELECT crypto_deposit_address FROM users WHERE crypto_deposit_address IS NOT NULL');
        const addresses = users.map(u => u.crypto_deposit_address.toLowerCase());
        monitoredAddresses = new Set(addresses);
        console.log(`[Listener] Monitoring ${monitoredAddresses.size} user deposit addresses across all networks.`);
    } catch (error) {
        console.error("[Listener] Error loading addresses from database:", error);
    }
}

async function handleDetectedTransaction({ hash, to, network, tokenType, value }) {
    const toAddress = to.toLowerCase();
    if (!monitoredAddresses.has(toAddress)) return;

    try {
        const { rows: [user] } = await db.query('SELECT id FROM users WHERE crypto_deposit_address = $1', [toAddress]);
        if (!user) return;

        const { rows: [existingDeposit] } = await db.query('SELECT id FROM crypto_deposits WHERE tx_hash = $1 AND network = $2', [hash, network]);
        if (existingDeposit) return;

        const tokenConfig = network === 'polygon' ? POLYGON_TOKENS[tokenType] : ETHEREUM_TOKENS[tokenType];
        const amountCrypto = parseFloat(ethers.formatUnits(value, tokenConfig.decimals));

        console.log(`[Listener] Detected pending ${network} deposit: ${amountCrypto} ${tokenType} to user ${user.id} (TX: ${hash})`);

        await db.query(
            `INSERT INTO crypto_deposits (user_id, tx_hash, network, token_type, amount_crypto, gem_amount, status)
             VALUES ($1, $2, $3, $4, $5, 0, 'pending')`,
            [user.id, hash, network, tokenType, amountCrypto]
        );

    } catch (error) {
        if (error.code !== '23505') {
            console.error(`[Listener] Error handling ${network} transaction ${hash}:`, error);
        }
    }
}

function startTransactionListener() {
    if (isListenerActive) return;
    if (!process.env.ALCHEMY_API_KEY) {
        console.warn("[Listener] ALCHEMY_API_KEY not found. Transaction listener service is disabled.");
        return;
    }

    console.log("[Listener] Starting WebSocket transaction listeners for Polygon and Ethereum...");
    isListenerActive = true;
    
    const alchemyPolygon = new Alchemy({ apiKey: process.env.ALCHEMY_API_KEY, network: Network.MATIC_MAINNET });
    const alchemyEthereum = new Alchemy({ apiKey: process.env.ALCHEMY_API_KEY, network: Network.ETH_MAINNET });

    loadMonitoredAddresses();

    alchemyPolygon.ws.on({ method: AlchemySubscription.PENDING_TRANSACTIONS }, (tx) => {
        if (tx.to && monitoredAddresses.has(tx.to.toLowerCase()) && tx.data === '0x') {
            handleDetectedTransaction({ hash: tx.hash, to: tx.to, network: 'polygon', tokenType: 'POL', value: tx.value });
        }
    });

    const polygonErc20Filter = { method: AlchemySubscription.PENDING_TRANSACTIONS, toAddress: [POLYGON_TOKENS.USDC.contractAddress, POLYGON_TOKENS.USDT.contractAddress] };
    alchemyPolygon.ws.on(polygonErc20Filter, (tx) => {
        const iface = new ethers.Interface(["function transfer(address to, uint256 amount)"]);
        try {
            const decoded = iface.parseTransaction({ data: tx.data });
            if (decoded && decoded.name === 'transfer' && monitoredAddresses.has(decoded.args.to.toLowerCase())) {
                const tokenType = tx.to.toLowerCase() === POLYGON_TOKENS.USDC.contractAddress ? 'USDC' : 'USDT';
                handleDetectedTransaction({ hash: tx.hash, to: decoded.args.to, network: 'polygon', tokenType, value: decoded.args.amount });
            }
        } catch (e) { /* Ignore non-transfer transactions */ }
    });
    
    alchemyEthereum.ws.on({ method: AlchemySubscription.PENDING_TRANSACTIONS }, (tx) => {
        if (tx.to && monitoredAddresses.has(tx.to.toLowerCase()) && tx.data === '0x') {
            handleDetectedTransaction({ hash: tx.hash, to: tx.to, network: 'ethereum', tokenType: 'ETH', value: tx.value });
        }
    });
    
    const ethErc20Filter = { method: AlchemySubscription.PENDING_TRANSACTIONS, toAddress: [ETHEREUM_TOKENS.USDC.contractAddress, ETHEREUM_TOKENS.USDT.contractAddress, ETHEREUM_TOKENS.PYUSD.contractAddress] };
    alchemyEthereum.ws.on(ethErc20Filter, (tx) => {
        const iface = new ethers.Interface(["function transfer(address to, uint256 amount)"]);
        try {
            const decoded = iface.parseTransaction({ data: tx.data });
            if (decoded && decoded.name === 'transfer' && monitoredAddresses.has(decoded.args.to.toLowerCase())) {
                const contract = tx.to.toLowerCase();
                let tokenType = '';
                if (contract === ETHEREUM_TOKENS.USDC.contractAddress) tokenType = 'USDC';
                else if (contract === ETHEREUM_TOKENS.USDT.contractAddress) tokenType = 'USDT';
                else if (contract === ETHEREUM_TOKENS.PYUSD.contractAddress) tokenType = 'PYUSD';
                if (tokenType) handleDetectedTransaction({ hash: tx.hash, to: decoded.args.to, network: 'ethereum', tokenType, value: decoded.args.amount });
            }
        } catch (e) { /* Ignore non-transfer transactions */ }
    });
}

function addAddressToMonitor(address) {
    const lowerCaseAddress = address.toLowerCase();
    if (address && !monitoredAddresses.has(lowerCaseAddress)) {
        monitoredAddresses.add(lowerCaseAddress);
        console.log(`[Listener] Added new address to live monitor: ${lowerCaseAddress}. Total: ${monitoredAddresses.size}`);
    }
}

module.exports = { startTransactionListener, addAddressToMonitor };
