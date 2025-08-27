// backend/core/services/xsollaService.js
const MOCK_VALID_PIN_BALANCE_USD = 20.00;

async function processVoucherPayment(pin, userId, amountUSD) {
    console.log(`[XsollaService] Attempting to process paysafecard PIN for user ${userId} for $${amountUSD}`);

    await new Promise(resolve => setTimeout(resolve, 800));

    if (pin.replace(/\s+/g, '') !== '0000111122223333') {
        throw new Error('Invalid paysafecard PIN.');
    }

    if (amountUSD > MOCK_VALID_PIN_BALANCE_USD) {
        throw new Error(`Insufficient funds. This PIN only has a balance of $${MOCK_VALID_PIN_BALANCE_USD.toFixed(2)}.`);
    }

    const transactionId = `psc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[XsollaService] Mock payment successful. Transaction ID: ${transactionId}`);

    return {
        transactionId: transactionId,
        amountCharged: amountUSD,
        currency: 'USD',
        provider: 'paysafecard'
    };
}

async function generateCashBarcode(userId, amountUSD) {
    console.log(`[XsollaService] Generating PayNearMe barcode for user ${userId} for $${amountUSD}`);

    await new Promise(resolve => setTimeout(resolve, 500));

    const transactionId = `pnm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const barcodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${transactionId}`;

    console.log(`[XsollaService] Mock barcode generated. Transaction ID: ${transactionId}`);

    return {
        transactionId,
        barcodeImageUrl,
        provider: 'paynearme'
    };
}

module.exports = {
    processVoucherPayment,
    generateCashBarcode
};
