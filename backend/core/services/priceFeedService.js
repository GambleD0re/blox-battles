// backend/core/services/priceFeedService.js
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

let providers;
let priceCache = {};
let lastFetchTimestamp = 0;
let ethers;

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

const getProviders = () => {
  if (providers) return providers;
  if (!ethers) ethers = require("ethers");

  const ETHEREUM_URL = process.env.ALCHEMY_ETHEREUM_URL ? process.env.ALCHEMY_ETHEREUM_URL.trim() : null;
  const POLYGON_URL  = process.env.ALCHEMY_POLYGON_URL ? process.env.ALCHEMY_POLYGON_URL.trim() : null;

  if (!ETHEREUM_URL || !POLYGON_URL) {
    throw new Error("Missing or empty ALCHEMY_ETHEREUM_URL or ALCHEMY_POLYGON_URL");
  }

  try {
    const ethProvider = new ethers.JsonRpcProvider(ETHEREUM_URL);
    const polyProvider = new ethers.JsonRpcProvider(POLYGON_URL);

    providers = {
      ethereum: ethProvider,
      polygon:  polyProvider,
    };
  } catch (error) {
    console.error("[PriceFeed FATAL] Failed to create JsonRpcProvider.", error);
    throw error;
  }
  
  return providers;
};

const fetchPricesFromChainlink = async () => {
  const provs = getProviders();
  console.log("[PriceFeed LOG] Fetching prices from Chainlink...");

  const pricePromises = Object.entries(TOKEN_CONFIG).map(async ([symbol, cfg]) => {
    const provider = provs[cfg.network];
    try {
      const contract = new ethers.Contract(cfg.address, AGGREGATORV3_ABI, provider);
      const [decimals, roundData] = await Promise.all([
        contract.decimals(),
        contract.latestRoundData()
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

const getLatestPrice = async (priceSymbol) => {
  const now = Date.now();
  if (now - lastFetchTimestamp > CACHE_DURATION_MS || !priceCache[priceSymbol] || priceCache[priceSymbol] === 0) {
    await fetchPricesFromChainlink();
  }
  return priceCache[priceSymbol] || 0;
};

const initializePriceFeed = async () => {
  try {
    console.log("[PriceFeed LOG] Initialization requested.");
    await fetchPricesFromChainlink();
  } catch (e) {
    console.error(`[PriceFeed ERROR] Initialization failed: ${e.message}`);
  }
};

module.exports = {
  getLatestPrice,
  initializePriceFeed,
};
