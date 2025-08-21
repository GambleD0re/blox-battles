// frontend/src/pages/WithdrawPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';

const Loader = ({ inline = false }) => (
    <div className={`flex items-center justify-center ${inline ? '' : 'p-8'}`}>
        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
);

const InfoCard = ({ title, children }) => (
    <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-lg">
        <h3 className="font-bold text-lg text-white mb-2">{title}</h3>
        <div className="text-gray-400 text-sm space-y-2">{children}</div>
    </div>
);

const WithdrawPage = () => {
    const { user, token, refreshUser, appConfig } = useAuth();
    const navigate = useNavigate();

    const GEM_TO_USD_CONVERSION_RATE = appConfig?.gemToUsdConversionRate || 110;
    const MINIMUM_GEM_WITHDRAWAL = appConfig?.minimumGemWithdrawal || 11;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [cryptoGemAmount, setCryptoGemAmount] = useState('');
    const [recipientAddress, setRecipientAddress] = useState('');
    const [selectedToken, setSelectedToken] = useState('USDC');

    const handleCryptoWithdrawalSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage({ text: '', type: '' });
        try {
            const result = await api.requestCryptoWithdrawal(parseInt(cryptoGemAmount, 10), recipientAddress, selectedToken, token);
            setMessage({ text: result.message, type: 'success' });
            setCryptoGemAmount('');
            setRecipientAddress('');
            refreshUser();
        } catch (error) {
            setMessage({ text: error.message, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const usdValue = cryptoGemAmount ? (parseInt(cryptoGemAmount, 10) / GEM_TO_USD_CONVERSION_RATE).toFixed(2) : '0.00';
    const isAmountValid = cryptoGemAmount && parseInt(cryptoGemAmount, 10) >= MINIMUM_GEM_WITHDRAWAL && parseInt(cryptoGemAmount, 10) <= user.gems;

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            {message.text && <div className={`mb-6 p-4 rounded-lg text-white font-bold ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{message.text}</div>}
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-bold text-white">Withdraw Gems</h1>
                <button onClick={() => navigate('/dashboard')} className="btn btn-secondary !mt-0">Back to Dashboard</button>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="widget text-center"><p className="text-sm text-gray-400">Current Balance</p><p className="text-3xl font-bold text-blue-400">{user?.gems.toLocaleString() || 0} Gems</p></div>
                <div className="widget text-center"><p className="text-sm text-gray-400">Conversion Rate</p><p className="text-lg font-semibold text-white">{GEM_TO_USD_CONVERSION_RATE} Gems = $1.00</p></div>
                <div className="widget text-center"><p className="text-sm text-gray-400">Withdrawable Value</p><p className="text-3xl font-bold text-green-400">${((user?.gems || 0) / GEM_TO_USD_CONVERSION_RATE).toFixed(2)}</p></div>
            </div>

            <div>
                <InfoCard title="Request Crypto Withdrawal">
                    <p>Withdraw your gems as USDC or USDT on the Polygon network. Ensure your wallet address is correct and supports Polygon to avoid loss of funds.</p>
                    <p className="font-bold text-yellow-400">Warning: Transactions on the blockchain are irreversible. Double-check your address before submitting.</p>
                </InfoCard>
                <form onSubmit={handleCryptoWithdrawalSubmit} className="mt-6 widget">
                    {/* ... form JSX remains largely unchanged ... */}
                </form>
            </div>
        </div>
    );
};

export default WithdrawPage;
