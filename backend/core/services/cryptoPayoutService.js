// backend/core/services/cryptoPayoutService.js
const ethers = require('ethers');
const { getProviders } = require('./providerService');

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

let wallet; // This will be our singleton wallet instance

const getWallet = async () => {
    if (wallet) return wallet;

    if (!PAYOUT_WALLET_PRIVATE_KEY) {
        throw new Error("Missing PAYOUT_WALLET_PRIVATE_KEY environment variable for payout service.");
    }

    const providers = await getProviders();
    if (!providers) {
        throw new Error("Blockchain providers are not available, cannot initialize payout wallet.");
    }
    
    wallet = new ethers.Wallet(PAYOUT_WALLET_PRIVATE_KEY, providers.polygon);
    console.log(`[PayoutService] Payout wallet initialized. Address: ${wallet.address}`);
    return wallet;
};


async function sendCryptoPayout(recipientAddress, amountUsd, tokenType) {
    const signer = await getWallet();
    const tokenConfig = SUPPORTED_TOKENS[tokenType];

    if (!tokenConfig) {
        throw new Error(`Unsupported token type: ${tokenType}`);
    }
    if (!ethers.isAddress(recipientAddress)) {
        throw new Error("Invalid recipient address provided.");
    }

    try {
        const contract = new ethers.Contract(tokenConfig.contractAddress, ERC20_ABI, signer);
        const decimals = tokenConfig.decimals;
        const currentPrice = await getLatestPrice(tokenType); // Fetch price for USDC, USDT etc.
        if (!currentPrice || currentPrice <= 0) {
        throw new Error(`Invalid price for ${tokenType}.`);
        }
        const cryptoAmountToSend = amountUsd / currentPrice;
        const amountInSmallestUnit = ethers.parseUnits(cryptoAmountToSend.toString(), decimals);

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
