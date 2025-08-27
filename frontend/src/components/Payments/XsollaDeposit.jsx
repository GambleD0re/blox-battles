// frontend/src/components/Payments/XsollaDeposit.jsx
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import DisabledFeature from './DisabledFeature';

const XsollaDeposit = ({ showMessage }) => {
    const { token, appConfig, systemStatus } = useAuth();
    
    const MINIMUM_USD_DEPOSIT = appConfig?.minimumUsdDeposit || 4;
    const USD_TO_GEMS_RATE = appConfig?.usdToGemsRate || 100;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [amountUSD, setAmountUSD] = useState(MINIMUM_USD_DEPOSIT.toFixed(2));
    const [gemAmount, setGemAmount] = useState(MINIMUM_USD_DEPOSIT * USD_TO_GEMS_RATE);

    const handleAmountChange = (e) => {
        const value = e.target.value;
        setAmountUSD(value);
        setGemAmount(!isNaN(value) && parseFloat(value) > 0 ? Math.floor(parseFloat(value) * USD_TO_GEMS_RATE) : 0);
    };

    const handlePurchase = async () => {
        if (parseFloat(amountUSD) < MINIMUM_USD_DEPOSIT) {
            showMessage({ text: `Minimum deposit is $${MINIMUM_USD_DEPOSIT.toFixed(2)}.`, type: 'error' });
            return;
        }
        setIsSubmitting(true);
        showMessage({ text: '', type: '' });
        try {
            const { token: xsollaToken } = await api.createXsollaTransaction(parseFloat(amountUSD), token);
            
            window.Xsolla.launch({ access_token: xsollaToken });
            window.Xsolla.on(window.Xsolla.Events.CLOSE, () => { setIsSubmitting(false); });
        } catch (err) {
            showMessage({ text: err.message, type: 'error' });
            setIsSubmitting(false);
        }
    };

    if (!systemStatus?.deposits_xsolla?.isEnabled) {
        return <DisabledFeature featureName="deposits_xsolla" />;
    }

    return (
        <div className="widget max-w-lg mx-auto">
            <h3 className="widget-title">Purchase with Prepaid Cards, Vouchers & More</h3>
            <div className="space-y-6 p-4">
                <div className="form-group">
                    <label htmlFor="amount-input" className="block text-sm font-medium text-gray-400 mb-1">Enter Amount (USD)</label>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-2xl">$</span>
                        <input id="amount-input" type="number" value={amountUSD} onChange={handleAmountChange} step="0.01" min={MINIMUM_USD_DEPOSIT} className="form-input !text-3xl !font-bold !p-2 flex-grow" />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Minimum deposit: ${MINIMUM_USD_DEPOSIT.toFixed(2)}</p>
                </div>
                <div className="text-center p-4 bg-gray-900/50 rounded-lg">
                    <p className="text-sm text-gray-400">You will receive:</p>
                    <p className="text-4xl font-black text-blue-400">{gemAmount.toLocaleString()}</p>
                    <p className="text-blue-400">Gems</p>
                </div>
                <button onClick={handlePurchase} disabled={isSubmitting || parseFloat(amountUSD) < MINIMUM_USD_DEPOSIT} className="btn btn-primary w-full mt-4">
                    {isSubmitting ? 'Loading...' : 'Proceed to Checkout'}
                </button>
            </div>
        </div>
    );
};

export default XsollaDeposit;
