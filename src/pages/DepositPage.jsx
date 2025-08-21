// frontend/src/pages/DepositPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { loadStripe } from '@stripe/stripe-js';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

const TabButton = ({ active, onClick, children }) => (
    <button onClick={onClick} className={`px-4 py-2 font-semibold rounded-t-lg border-b-2 transition-colors ${active ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
        {children}
    </button>
);
const QRCode = ({ address }) => <img src={`https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${address}`} alt="Deposit Address QR Code" className="rounded-lg border-4 border-white mx-auto" />;
const CryptoTokenIcon = ({ mainSrc, networkSrc, alt }) => (
    <div className="relative w-10 h-10 shrink-0">
        <img src={mainSrc} alt={alt} className="w-8 h-8 rounded-full" />
        {networkSrc && <img src={networkSrc} alt="Network" className="w-4 h-4 rounded-full absolute -top-1 -right-1 ring-1 ring-gray-900" />}
    </div>
);

const DepositPage = () => {
    const { token, refreshUser, appConfig } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [message, setMessage] = useState({ text: '', type: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('card');
    const [amountUSD, setAmountUSD] = useState(appConfig?.minimumUsdDeposit?.toFixed(2) || '4.00');
    const [gemAmount, setGemAmount] = useState((appConfig?.minimumUsdDeposit || 4) * (appConfig?.usdToGemsRate || 100));
    const [cryptoAddress, setCryptoAddress] = useState('');
    const [selectedNetwork, setSelectedNetwork] = useState('ethereum');
    const [selectedToken, setSelectedToken] = useState('ETH');
    const [quote, setQuote] = useState(null);
    const [isQuoteLoading, setIsQuoteLoading] = useState(false);
    
    // Static data for UI, should match backend configuration
    const depositTokens = {
        polygon: [{ symbol: 'USDC', name: 'USD Coin', ... }, { symbol: 'USDT', name: 'Tether', ... }, { symbol: 'POL', name: 'Polygon', ... }],
        ethereum: [{ symbol: 'ETH', name: 'Ethereum', ... }, { symbol: 'USDC', name: 'USD Coin', ... }, { symbol: 'USDT', name: 'Tether USD', ... }, { symbol: 'PYUSD', name: 'PayPal USD', ... }],
    };

    useEffect(() => {
        if (searchParams.get('success')) {
            setMessage({ text: 'Purchase successful! Your gems have been added.', type: 'success' });
            refreshUser();
            navigate('/deposit', { replace: true });
        }
        if (searchParams.get('canceled')) {
            setMessage({ text: 'Purchase canceled. You have not been charged.', type: 'error' });
            navigate('/deposit', { replace: true });
        }
    }, [searchParams, refreshUser, navigate]);

    const fetchCryptoAddress = useCallback(async () => {
        if (!token) return;
        try {
            const data = await api.getCryptoDepositAddress(token);
            setCryptoAddress(data.address);
        } catch (error) {
            setMessage({ text: 'Could not fetch your crypto deposit address.', type: 'error' });
        }
    }, [token]);

    useEffect(() => {
        if (activeTab === 'crypto') fetchCryptoAddress();
    }, [activeTab, fetchCryptoAddress]);
    
    useEffect(() => {
        setSelectedToken(depositTokens[selectedNetwork][0].symbol);
        setQuote(null);
    }, [selectedNetwork]);

    const handleAmountChange = (e) => {
        const value = e.target.value;
        setAmountUSD(value);
        setGemAmount(!isNaN(value) && parseFloat(value) > 0 ? Math.floor(parseFloat(value) * (appConfig?.usdToGemsRate || 100)) : 0);
    };

    const handleStripePurchase = async () => { /* ... unchanged logic ... */ };
    const handleGetQuote = async () => { /* ... unchanged logic ... */ };

    // Rendering logic for card and crypto tabs remains the same, but with updated navigation
    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {message.text && <div className={`mb-6 p-4 rounded-lg text-white font-bold ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{message.text}</div>}
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-bold text-white">Deposit Gems</h1>
                <button onClick={() => navigate('/dashboard')} className="btn btn-secondary !mt-0">Back to Dashboard</button>
            </header>
            <div className="border-b border-gray-700 mb-6">
                <TabButton active={activeTab === 'card'} onClick={() => setActiveTab('card')}>Credit Card</TabButton>
                <TabButton active={activeTab === 'crypto'} onClick={() => setActiveTab('crypto')}>Crypto</TabButton>
            </div>
            {/* ... rest of the component JSX ... */}
        </div>
    );
};

export default DepositPage;
