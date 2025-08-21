// backend/core/services/transactionConfirmationService.js
const { Alchemy, Network } = require("alchemy-sdk");
const db = require('../../database/database');
const { getLatestPrice } = require('./priceFeedService');

const CONFIRMATION_CHECK_INTERVAL = 60 * 1000;

const alchemyPolygon = new Alchemy({
    apiKey: process.env.ALCHEMY_API_KEY,
    network: Network.MATIC_MAINNET,
});
const alchemyEthereum = new Alchemy({
    apiKey: process.env.ALCHEMY_API_KEY,
    network: Network.ETH_MAINNET,
});

const alchemyClients = {
    polygon: alchemyPolygon,
    ethereum: alchemyEthereum,
};

async function getLatestBlockNumber(network) {
    try {
        const client = alchemyClients[network];
        if (!client) throw new Error(`Invalid network: ${network}`);
        return await client.core.getBlockNumber();
    } catch (error) {
        console.error(`[Confirmer] Error fetching latest block number for ${network}:`, error);
        return 0;
    }
}

async function processPendingDeposits() {
    try {
        const { rows: pendingDeposits } = await db.query("SELECT * FROM crypto_deposits WHERE status = 'pending'");
        if (pendingDeposits.length === 0) {
            return;
        }

        console.log(`[Confirmer] Checking ${pendingDeposits.length} pending deposits...`);

        const latestBlocks = {
            polygon: await getLatestBlockNumber('polygon'),
            ethereum: await getLatestBlockNumber('ethereum'),
        };

        for (const deposit of pendingDeposits) {
            const client = await db.getPool().connect();
            try {
                const alchemyClient = alchemyClients[deposit.network];
                const latestBlock = latestBlocks[deposit.network];
                if (!alchemyClient || latestBlock === 0) {
                    client.release();
                    continue;
                }

                const txReceipt = await alchemyClient.core.getTransactionReceipt(deposit.tx_hash);
                if (!txReceipt || !txReceipt.blockNumber) {
                    client.release();
                    continue;
                }

                if (txReceipt.status === 0) {
                    await client.query("UPDATE crypto_deposits SET status = 'failed' WHERE id = $1", [deposit.id]);
                    client.release();
                    continue;
                }
                
                const confirmations = latestBlock - txReceipt.blockNumber;
                if (confirmations >= deposit.required_confirmations) {
                    await client.query('BEGIN');
                    
                    const GEM_PER_DOLLAR = parseInt(process.env.USD_TO_GEMS_RATE || '100', 10);
                    const priceSymbol = `${deposit.token_type}_USD_${deposit.network.toUpperCase()}`;
                    const currentPrice = await getLatestPrice(priceSymbol);
                    
                    if (!currentPrice || currentPrice <= 0) {
                        throw new Error(`Could not fetch a valid price for ${deposit.token_type} on ${deposit.network}.`);
                    }

                    const usdValue = parseFloat(deposit.amount_crypto) * currentPrice;
                    const gemsToCredit = Math.floor(usdValue * GEM_PER_DOLLAR);

                    await client.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [gemsToCredit, deposit.user_id]);
                    await client.query(
                        "UPDATE crypto_deposits SET status = 'credited', credited_at = NOW(), block_number = $1, gem_amount = $2 WHERE id = $3", 
                        [txReceipt.blockNumber, gemsToCredit, deposit.id]
                    );
                    
                    await client.query('COMMIT');
                    console.log(`[Confirmer] Credited ${gemsToCredit} gems to user ${deposit.user_id} for ${deposit.amount_crypto} ${deposit.token_type} on ${deposit.network}.`);
                }

            } catch (error) {
                await client.query('ROLLBACK').catch(console.error);
                console.error(`[Confirmer] Error processing deposit ID ${deposit.id} (TX: ${deposit.tx_hash}):`, error);
            } finally {
                client.release();
            }
        }

    } catch (error) {
        console.error("[Confirmer] A critical error occurred in the main processing loop:", error);
    }
}

function startConfirmationService() {
    console.log(`[Confirmer] Starting confirmation service. Check interval: ${CONFIRMATION_CHECK_INTERVAL / 1000} seconds.`);
    processPendingDeposits();
    setInterval(processPendingDeposits, CONFIRMATION_CHECK_INTERVAL);
}

module.exports = { startConfirmationService };
