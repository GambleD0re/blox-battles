// frontend/src/pages/DepositPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';

const DepositPage = () => {
    const { token, refreshUser, appConfig } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    
    const MINIMUM_USD_DEPOSIT = appConfig?.minimumUsdDeposit || 4;
    const USD_TO_GEMS_RATE = appConfig?.usdToGemsRate || 100;

    const [message, setMessage] = useState({ text: '', type: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [amountUSD, setAmountUSD] = useState(MINIMUM_USD_DEPOSIT.toFixed(2));
    const [gemAmount, setGemAmount] = useState(MINIMUM_USD_DEPOSIT * USD_TO_GEMS_RATE);
    
    useEffect(() => {
        if (searchParams.get('success')) {
            setMessage({ text: 'Purchase successful! Your gems should be added shortly.', type: 'success' });
            refreshUser();
            navigate('/deposit', { replace: true });
        }
        if (searchParams.get('canceled')) {
            setMessage({ text: 'Purchase canceled.', type: 'error' });
            navigate('/deposit', { replace: true });
        }
    }, [searchParams, refreshUser, navigate]);

    const handleAmountChange = (e) => {
        const value = e.target.value;
        setAmountUSD(value);
        setGemAmount(!isNaN(value) && parseFloat(value) > 0 ? Math.floor(parseFloat(value) * USD_TO_GEMS_RATE) : 0);
    };

    const handlePurchase = async () => {
        if (parseFloat(amountUSD) < MINIMUM_USD_DEPOSIT) {
            setMessage({ text: `Minimum deposit is $${MINIMUM_USD_DEPOSIT.toFixed(2)}.`, type: 'error' });
            return;
        }
        setIsSubmitting(true);
        setMessage({ text: '', type: '' });
        try {
            const { token: xsollaToken } = await api.createXsollaTransaction(parseFloat(amountUSD), token);
            
            window.Xsolla.launch({
                access_token: xsollaToken,
            });

            window.Xsolla.on(window.Xsolla.Events.CLOSE, () => {
                setIsSubmitting(false);
            });

        } catch (err) {
            setMessage({ text: err.message, type: 'error' });
            setIsSubmitting(false);
        }
    };
    
    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {message.text && <div className={`mb-6 p-4 rounded-lg text-white font-bold ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{message.text}</div>}
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-bold text-white">Deposit Gems</h1>
                <button onClick={() => navigate('/dashboard')} className="btn btn-secondary !mt-0">Back to Dashboard</button>
            </header>
            
            <div className="widget max-w-lg mx-auto">
                <h3 className="widget-title">Purchase Gems</h3>
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
                        {isSubmitting ? 'Loading...' : `Proceed to Checkout`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DepositPage;
