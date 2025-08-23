// backend/core/services/priceFeedService.js
const { getProviders } = require('./providerService');
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

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

const fetchPricesFromChainlink = async () => {
  const provs = await getProviders();
  if (!provs) {
      console.warn("[PriceFeed] Providers not available. Skipping price fetch.");
      return;
  }
  if (!ethers) ethers = require("ethers");

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
  try {
    console.log("[PriceFeed LOG] Initialization requested.");
    await fetchPricesFromChainlink();
  } catch (e) {
    console.error(`[PriceFeed ERROR] Initialization failed: ${e.message}`);
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
