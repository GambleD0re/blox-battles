// backend/core/services/providerService.js
const ethers = require('ethers');

let providers = null;
let isInitializing = false;
let hasInitializationFailed = false;

const initializeWithRetries = async (maxRetries = 5, retryDelay = 5000) => {
    if (providers) return providers;
    if (hasInitializationFailed) return null;
    
    if (isInitializing) {
        await new Promise(resolve => {
            const interval = setInterval(() => {
                if (!isInitializing) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });
        return providers;
    }

    isInitializing = true;

    const ETHEREUM_URL = process.env.ALCHEMY_ETHEREUM_URL ? process.env.ALCHEMY_ETHEREUM_URL.trim() : null;
    const POLYGON_URL = process.env.ALCHEMY_POLYGON_URL ? process.env.ALCHEMY_POLYGON_URL.trim() : null;

    if (!ETHEREUM_URL || !POLYGON_URL) {
        console.error("[ProviderService] FATAL: Missing ALCHEMY_ETHEREUM_URL or ALCHEMY_POLYGON_URL. Blockchain services will be disabled.");
        hasInitializationFailed = true;
        isInitializing = false;
        return null;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[ProviderService] Attempt ${attempt}/${maxRetries}: Connecting to blockchain nodes...`);
            
            const ethProvider = new ethers.JsonRpcProvider(ETHEREUM_URL);
            const polyProvider = new ethers.JsonRpcProvider(POLYGON_URL);
            
            await Promise.all([ethProvider.getBlockNumber(), polyProvider.getBlockNumber()]);

            console.log(`[ProviderService] Successfully connected to providers on attempt ${attempt}.`);
            providers = { ethereum: ethProvider, polygon: polyProvider };
            isInitializing = false;
            return providers;
        } catch (error) {
            // [MODIFIED] Check for the specific "403 Forbidden" error from Alchemy
            if (error.code === 'SERVER_ERROR' && error.info?.responseStatus?.includes('403')) {
                console.error("[ProviderService] FATAL: Received '403 Forbidden' from Alchemy. The API key or App is inactive.");
                console.error("[ProviderService] Please update your ALCHEMY_ETHEREUM_URL and ALCHEMY_POLYGON_URL environment variables with a valid key.");
                console.error("[ProviderService] Halting all retry attempts for blockchain services.");
                hasInitializationFailed = true;
                isInitializing = false;
                return null; // Stop retrying immediately
            }

            console.warn(`[ProviderService] Attempt ${attempt} failed: ${error.message}`);
            if (attempt === maxRetries) {
                console.error("[ProviderService] FATAL: All provider initialization attempts failed. Blockchain services will be disabled.");
                hasInitializationFailed = true;
                isInitializing = false;
                return null;
            }
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
};

const getProviders = async () => {
    if (providers) return providers;
    return await initializeWithRetries();
};

module.exports = {
    getProviders,
};
