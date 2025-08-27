// backend/core/routes/payments.js
const express = require('express');
const { body } = require('express-validator');
const { authenticateToken, handleValidationErrors, checkFeatureFlag } = require('../../middleware/auth');
const db = require('../../database/database');
const { getUserDepositAddress } = require('../services/hdWalletService');
const { getLatestPrice } = require('../services/priceFeedService');
const { addAddressToMonitor } = require('../services/transactionListenerService');
const { createTransactionToken } = require('../services/xsollaService');

const router = express.Router();

const USD_TO_GEMS_RATE = parseInt(process.env.USD_TO_GEMS_RATE || '100', 10);
const MINIMUM_USD_DEPOSIT = parseFloat(process.env.MINIMUM_USD_DEPOSIT || '4');

router.post('/create-xsolla-transaction',
    authenticateToken,
    checkFeatureFlag('deposits_xsolla'),
    body('amountUSD').isFloat({ gt: MINIMUM_USD_DEPOSIT - 0.01 }).withMessage(`Minimum deposit is $${MINIMUM_USD_DEPOSIT.toFixed(2)}.`),
    handleValidationErrors,
    async (req, res) => {
        try {
            const { amountUSD } = req.body;
            const { userId, username } = req.user;
            
            const xsollaData = await createTransactionToken(userId, username, amountUSD);
            
            res.status(200).json(xsollaData);

        } catch (error) {
            console.error("Xsolla Transaction Init Error:", error);
            res.status(500).json({ message: error.message || 'Failed to create Xsolla payment session.' });
        }
    }
);

router.get('/crypto-address', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const { rows: [user] } = await db.query('SELECT user_index, crypto_deposit_address FROM users WHERE id = $1', [userId]);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (user.crypto_deposit_address) {
            return res.status(200).json({ address: user.crypto_deposit_address });
        }
        
        const userIndex = user.user_index;
        const newAddress = getUserDepositAddress(userIndex);

        await db.query('UPDATE users SET crypto_deposit_address = $1 WHERE id = $2', [newAddress, userId]);
        
        addAddressToMonitor(newAddress);
        res.status(200).json({ address: newAddress });

    } catch (error) {
        console.error("Crypto Address Generation Error:", error);
        res.status(500).json({ message: 'Failed to get or generate a deposit address.' });
    }
});

router.post('/crypto-quote',
    authenticateToken,
    [
        body('amount').isFloat({ gt: MINIMUM_USD_DEPOSIT - 0.01 }).withMessage(`Minimum deposit is $${MINIMUM_USD_DEPOSIT.toFixed(2)}.`),
        body('network').isIn(['polygon', 'ethereum']).withMessage('Invalid network type.'),
        body('tokenType').isIn(['USDC', 'USDT', 'POL', 'ETH', 'PYUSD']).withMessage('Invalid token type.')
    ],
    handleValidationErrors,
    async (req, res) => {
        const { amount, network, tokenType } = req.body;
        try {
            const packageUsdValue = parseFloat(amount);
            const gemAmount = Math.floor(packageUsdValue * USD_TO_GEMS_RATE);
            
            const priceSymbol = `${tokenType}_USD_${network.toUpperCase()}`;
            const currentPrice = await getLatestPrice(priceSymbol);

            if (!currentPrice || currentPrice <= 0) {
                throw new Error(`Could not fetch a valid price for ${tokenType} on ${network}.`);
            }

            const cryptoAmount = packageUsdValue / currentPrice;

            res.status(200).json({
                gemAmount: gemAmount,
                tokenType: tokenType,
                network: network,
                usdValue: packageUsdValue,
                cryptoAmount: cryptoAmount.toFixed(8),
                quoteExpiration: Date.now() + 15 * 60 * 1000
            });

        } catch (error) {
            console.error(`Crypto Quote Error for ${tokenType} on ${network}:`, error);
            res.status(500).json({ message: `Failed to generate a deposit quote for ${tokenType}.` });
        }
    }
);

module.exports = router;
