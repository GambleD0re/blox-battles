// backend/core/services/xsollaService.js
const crypto = require('crypto');

const MERCHANT_ID = process.env.XSOLLA_MERCHANT_ID;
const PROJECT_ID = process.env.XSOLLA_PROJECT_ID;
const API_KEY = process.env.XSOLLA_API_KEY;
const API_BASE_URL = 'https://api.xsolla.com';

async function createTransactionToken(userId, username, amountUSD) {
    if (!MERCHANT_ID || !PROJECT_ID || !API_KEY) {
        throw new Error('Xsolla configuration is missing on the server.');
    }

    const endpoint = `/v1/merchants/${MERCHANT_ID}/token`;
    const url = `${API_BASE_URL}${endpoint}`;

    const requestBody = {
        user: {
            id: { value: userId },
            name: { value: username }
        },
        settings: {
            project_id: parseInt(PROJECT_ID, 10),
            ui: {
                theme: "dark"
            }
        },
        purchase: {
            checkout: {
                amount: amountUSD,
                currency: 'USD'
            }
        }
    };

    const signature = crypto.createHmac('sha256', API_KEY).update(JSON.stringify(requestBody) + endpoint).digest('hex');

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
            'X-PARTNER-AUTH': signature
        },
        body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("Xsolla Token Error:", data);
        throw new Error(data.error?.message || 'Failed to initialize payment with Xsolla.');
    }

    return data;
}

module.exports = {
    createTransactionToken
};
