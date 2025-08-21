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

async function ensureInitialized() {
    if (isInitialized) {
        return;
    }
    if (!ALCHEMY_POLYGON_URL || !PAYOUT_WALLET_PRIVATE_KEY) {
        throw new Error("Missing required crypto environment variables for payout service.");
    }
    try {
        provider = new ethers.JsonRpcProvider(ALCHEMY_POLYGON_URL);
        wallet = new ethers.Wallet(PAYOUT_WALLET_PRIVATE_KEY, provider);
        isInitialized = true;
        console.log(`Crypto Payout Service Initialized. Wallet Address: ${wallet.address}`);
    } catch (error) {
        isInitialized = false;
        console.error("Failed to initialize Crypto Payout Service:", error);
        throw new Error("Could not connect to the blockchain network.");
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
