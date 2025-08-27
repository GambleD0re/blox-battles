// backend/core/services/hdWalletService.js
const { ethers } = require('ethers');

const MASTER_XPUB = process.env.MASTER_XPUB;

let masterNode;
let isInitialized = false;

function initializeHdWalletService() {
    if (!MASTER_XPUB) {
        console.error("FATAL ERROR: MASTER_XPUB must be set in .env to generate deposit addresses.");
        throw new Error("Missing MASTER_XPUB environment variable.");
    }
    try {
        masterNode = ethers.HDNodeWallet.fromExtendedKey(MASTER_XPUB);
        isInitialized = true;
        console.log("HD Wallet Service Initialized successfully.");
    } catch (error) {
        console.error("Failed to initialize HD Wallet Service. Check if MASTER_XPUB is valid.", error);
        throw error;
    }
}

function getUserDepositAddress(userId) {
    if (!isInitialized) {
        throw new Error("HD Wallet Service is not initialized.");
    }
    const derivationPath = `0/${userId}`;
    const userNode = masterNode.derivePath(derivationPath);
    return userNode.address;
}

try {
    initializeHdWalletService();
} catch (e) {
    console.warn("HD Wallet Service initialization failed. Deposit address generation will not be available.", e.message);
}

module.exports = {
    getUserDepositAddress
};
