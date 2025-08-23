// backend/core/services/cryptoPayoutService.js
const ethers = require('ethers');

const ALCHEMY_POLYGON_URL = process.env.ALCHEMY_POLYGON_URL;
const PAYOUT_WALLET_PRIVATE_KEY = process.env.PAYOUT_WALLET_PRIVATE_KEY;

const SUPPORTED_TOKENS = {
    'USDC': {
        contractAddress: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
        decimals: 6
    },
    'USDT': {
        contractAddress: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
        decimals: 6
    }
};

const ERC20_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)"
];

let provider;
let wallet;
let isInitialized = false;
let isInitializing = false;

async function ensureInitialized(maxRetries = 5, retryDelay = 5000) {
    if (isInitialized) return;
    if (isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait if another process is already initializing
        return;
    }
    isInitializing = true;

    if (!ALCHEMY_POLYGON_URL || !PAYOUT_WALLET_PRIVATE_KEY) {
        isInitializing = false;
        throw new Error("Missing required crypto environment variables for payout service.");
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const tempProvider = new ethers.JsonRpcProvider(ALCHEMY_POLYGON_URL);
            await tempProvider.getBlockNumber(); // Verify connection
            
            provider = tempProvider;
            wallet = new ethers.Wallet(PAYOUT_WALLET_PRIVATE_KEY, provider);
            isInitialized = true;
            isInitializing = false;
            console.log(`[PayoutService] Initialized. Wallet Address: ${wallet.address} (Attempt ${attempt})`);
            return;
        } catch (error) {
            console.warn(`[PayoutService] Initialization attempt ${attempt} failed: ${error.message}`);
            if (attempt === maxRetries) {
                isInitializing = false;
                throw new Error("Could not connect to the blockchain network after multiple retries.");
            }
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
}

async function sendCryptoPayout(recipientAddress, amountUsd, tokenType) {
    await ensureInitialized();
    const tokenConfig = SUPPORTED_TOKENS[tokenType];
    if (!tokenConfig) {
        throw new Error(`Unsupported token type: ${tokenType}`);
    }
    if (!ethers.isAddress(recipientAddress)) {
        throw new Error("Invalid recipient address provided.");
    }
    try {
        const contract = new ethers.Contract(tokenConfig.contractAddress, ERC20_ABI, wallet);
        const decimals = tokenConfig.decimals;
        const amountInSmallestUnit = ethers.parseUnits(amountUsd.toString(), decimals);

        await contract.transfer.estimateGas(recipientAddress, amountInSmallestUnit);
        const tx = await contract.transfer(recipientAddress, amountInSmallestUnit);
        
        console.log(`${tokenType} Payout transaction sent. Hash: ${tx.hash}`);
        return tx.hash;
    } catch (error) {
        console.error(`${tokenType} Payout Failed for address ${recipientAddress}:`, error);
        throw new Error(`Failed to process the ${tokenType} payout.`);
    }
}

module.exports = {
    sendCryptoPayout
};
