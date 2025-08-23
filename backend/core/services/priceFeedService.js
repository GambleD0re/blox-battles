// backend/core/services/priceFeedService.js
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

let providers;
let priceCache = {};
let lastFetchTimestamp = 0;
let ethers;
let isInitializing = false;
let hasInitializationFailed = false;

const AGGREGATORV3_ABI = [
  "function decimals() view returns (uint8)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)"
];

const TOKEN_CONFIG = {
  POL_USD_POLYGON:   { address: "0xab594600376ec9fd91f8e8853da8680b05e5d476", network: "polygon" },
  USDC_USD_POLYGON:  { address: "0xfe4a8cc5b5b2366c1b58bea3858e81843581b2f7", network: "polygon" },
  USDT_USD_POLYGON:  { address: "0x0a65136f62df2842f58619719656521f452d5640", network: "polygon" },
  ETH_USD_ETHEREUM:  { address: "0x5f4ec3df9cbd43714fe274045f3641376c318307", network: "ethereum" },
  USDC_USD_ETHEREUM: { address: "0x8fffffd4afb6115b954fe326c6b9eb0c267626c1", network: "ethereum" },
  USDT_USD_ETHEREUM: { address: "0x3e7d1eab13ad0104d2750b8863b489d65364e32d", network: "ethereum" },
  PYUSD_USD_ETHEREUM:{ address: "0x243932a2411855a4ea37346231a5a46c49ab1730", network: "ethereum" }
};

const initializeWithRetries = async (maxRetries = 5, retryDelay = 500000) => {
    if (providers) return providers;
    if (isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 1000000));
        return providers;
    }
    isInitializing = true;

    if (!ethers) ethers = require("ethers");

    const ETHEREUM_URL = process.env.ALCHEMY_ETHEREUM_URL ? process.env.ALCHEMY_ETHEREUM_URL.trim() : null;
    const POLYGON_URL = process.env.ALCHEMY_POLYGON_URL ? process.env.ALCHEMY_POLYGON_URL.trim() : null;

    if (!ETHEREUM_URL || !POLYGON_URL) {
        console.error("[PriceFeed FATAL] Missing ALCHEMY_ETHEREUM_URL or ALCHEMY_POLYGON_URL. Price feed will be disabled.");
        hasInitializationFailed = true;
        isInitializing = false;
        return null;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const ethProvider = new ethers.JsonRpcProvider(ETHEREUM_URL);
            const polyProvider = new ethers.JsonRpcProvider(POLYGON_URL);
            
            // Perform a simple check to ensure the connection is live
            await Promise.all([ethProvider.getBlockNumber(), polyProvider.getBlockNumber()]);

            console.log(`[PriceFeed] Successfully connected to providers on attempt ${attempt}.`);
            providers = { ethereum: ethProvider, polygon: polyProvider };
            isInitializing = false;
            return providers;
        } catch (error) {
            console.warn(`[PriceFeed] Provider initialization attempt ${attempt} failed: ${error.message}`);
            if (attempt === maxRetries) {
                console.error("[PriceFeed FATAL] All provider initialization attempts failed. Price feed will be disabled.");
                hasInitializationFailed = true;
                isInitializing = false;
                return null;
            }
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
};


const fetchPricesFromChainlink = async () => {
  const provs = await initializeWithRetries();
  if (!provs || hasInitializationFailed) return;

  console.log("[PriceFeed LOG] Fetching prices from Chainlink...");

  const pricePromises = Object.entries(TOKEN_CONFIG).map(async ([symbol, cfg]) => {
    const provider = provs[cfg.network];
    try {
      const contract = new ethers.Contract(cfg.address, AGGREGATORV3_ABI, provider);
      const [decimals, roundData] = await Promise.all([
        Promise.race([contract.decimals(), new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))]),
        Promise.race([contract.latestRoundData(), new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))])
      ]);
      const price = Number(ethers.formatUnits(roundData.answer, decimals));
      return { symbol, price };
    } catch (error) {
      console.error(`[PriceFeed ERROR] Failed to fetch price for ${symbol}:`, error.message);
      return { symbol, price: priceCache[symbol] || 0 };
    }
  });

  const results = await Promise.all(pricePromises);
  priceCache = Object.fromEntries(results.map(r => [r.symbol, r.price]));
  lastFetchTimestamp = Date.now();
};

const initializePriceFeed = async () => {
  if (hasInitializationFailed) return;
  try {
    console.log("[PriceFeed LOG] Initialization requested.");
    await fetchPricesFromChainlink();
  } catch (e) {
    console.error(`[PriceFeed ERROR] Initialization failed: ${e.message}`);
    hasInitializationFailed = true;
  }
};

const getLatestPrice = async (priceSymbol) => {
  const now = Date.now();
  if (!priceCache[priceSymbol] || priceCache[priceSymbol] === 0 || now - lastFetchTimestamp > CACHE_DURATION_MS) {
    await fetchPricesFromChainlink();
  }
  return priceCache[priceSymbol] || 0;
};

module.exports = {
  getLatestPrice,
  initializePriceFeed,
};
