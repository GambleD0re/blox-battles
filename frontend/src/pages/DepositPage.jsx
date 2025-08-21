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
    
    const depositTokens = {
        polygon: [
            { symbol: 'USDC', name: 'USD Coin', mainSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/137/0x3c499c542cef5e3811e1192ce70d8cc03d5c3359.png', networkSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/137/0x0000000000000000000000000000000000000000.png' },
            { symbol: 'USDT', name: 'Tether', mainSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/137/0xc2132d05d31c914a87c6611c10748aeb04b58e8f.png', networkSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/137/0x0000000000000000000000000000000000000000.png' },
            { symbol: 'POL', name: 'Polygon', mainSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/137/0x0000000000000000000000000000000000000000.png', networkSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/137/0x0000000000000000000000000000000000000000.png' },
        ],
        ethereum: [
            { symbol: 'ETH', name: 'Ethereum', mainSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/1/0x0000000000000000000000000000000000000000.png', networkSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/1/0x0000000000000000000000000000000000000000.png' },
            { symbol: 'USDC', name: 'USD Coin', mainSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/1/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png', networkSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/1/0x0000000000000000000000000000000000000000.png' },
            { symbol: 'USDT', name: 'Tether USD', mainSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/1/0xdac17f958d2ee523a2206206994597c13d831ec7.png', networkSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/1/0x0000000000000000000000000000000000000000.png' },
            { symbol: 'PYUSD', name: 'PayPal USD', mainSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/1/0x6c3ea9036406852006290770bedfcaba0e23a0e8.png', networkSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/1/0x0000000000000000000000000000000000000000.png' },
        ],
    };

    useEffect(() => {
        if (searchParams.get('success')) {
            setMessage({ text: 'Purchase successful! Your gems have been added.', type: 'success' });
            refreshUser();
            navigate('/deposit', { replace: true });
        }
        if (searchParams.get('canceled')) {
            setMessage({ text: 'Purchase canceled.', type: 'error' });
            navigate('/deposit', { replace: true });
        }
    }, [searchParams, refreshUser, navigate]);

    const fetchCryptoAddress = useCallback(async () => {
        if (!token) return;
        try {
            const data = await api.getCryptoDepositAddress(token);
            setCryptoAddress(data.address);
        } catch (error) {
            setMessage({ text: error.message, type: 'error' });
        }
    }, [token]);

    useEffect(() => { if (activeTab === 'crypto') fetchCryptoAddress(); }, [activeTab, fetchCryptoAddress]);
    useEffect(() => { setSelectedToken(depositTokens[selectedNetwork][0].symbol); setQuote(null); }, [selectedNetwork]);

    const handleAmountChange = (e) => {
        const value = e.target.value;
        setAmountUSD(value);
        setGemAmount(!isNaN(value) && parseFloat(value) > 0 ? Math.floor(parseFloat(value) * (appConfig?.usdToGemsRate || 100)) : 0);
    };

    const handleStripePurchase = async () => { /* ... unchanged ... */ };
    const handleGetQuote = async () => { /* ... unchanged ... */ };

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {/* ... rest of the component JSX is unchanged ... */}
        </div>
    );
};

export default DepositPage;
