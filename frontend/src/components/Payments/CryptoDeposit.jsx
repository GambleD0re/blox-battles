// frontend/src/components/Payments/CryptoDeposit.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import DisabledFeature from './DisabledFeature';

const QRCode = ({ address }) => <img src={`https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${address}`} alt="Deposit Address QR Code" className="rounded-lg border-4 border-white mx-auto" />;
const CryptoTokenIcon = ({ mainSrc, networkSrc, alt }) => (
    <div className="relative w-10 h-10 shrink-0"><img src={mainSrc} alt={alt} className="w-8 h-8 rounded-full" /><img src={networkSrc} alt="Network" className="w-4 h-4 rounded-full absolute -top-1 -right-1 ring-1 ring-gray-900" /></div>
);

const CryptoDeposit = ({ showMessage }) => {
    const { token, appConfig, systemStatus } = useAuth();

    const MINIMUM_USD_DEPOSIT = appConfig?.minimumUsdDeposit || 4;
    const USD_TO_GEMS_RATE = appConfig?.usdToGemsRate || 100;
    
    const [amountUSD, setAmountUSD] = useState(MINIMUM_USD_DEPOSIT.toFixed(2));
    const [cryptoAddress, setCryptoAddress] = useState('');
    const [selectedNetwork, setSelectedNetwork] = useState('ethereum');
    const [selectedToken, setSelectedToken] = useState('ETH');
    const [quote, setQuote] = useState(null);
    const [isQuoteLoading, setIsQuoteLoading] = useState(false);

    const depositTokens = {
        polygon: [{ symbol: 'USDC', name: 'USD Coin', mainSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/137/0x3c499c542cef5e3811e1192ce70d8cc03d5c3359.png', networkSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/137/0x0000000000000000000000000000000000000000.png' }, { symbol: 'USDT', name: 'Tether', mainSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/137/0xc2132d05d31c914a87c6611c10748aeb04b58e8f.png', networkSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/137/0x0000000000000000000000000000000000000000.png' }, { symbol: 'POL', name: 'Polygon', mainSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/137/0x0000000000000000000000000000000000000000.png', networkSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/137/0x0000000000000000000000000000000000000000.png' }],
        ethereum: [{ symbol: 'ETH', name: 'Ethereum', mainSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/1/0x0000000000000000000000000000000000000000.png', networkSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/1/0x0000000000000000000000000000000000000000.png' }, { symbol: 'USDC', name: 'USD Coin', mainSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/1/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png', networkSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/1/0x0000000000000000000000000000000000000000.png' }, { symbol: 'USDT', name: 'Tether USD', mainSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/1/0xdac17f958d2ee523a2206206994597c13d831ec7.png', networkSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/1/0x0000000000000000000000000000000000000000.png' }, { symbol: 'PYUSD', name: 'PayPal USD', mainSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/1/0x6c3ea9036406852006290770bedfcaba0e23a0e8.png', networkSrc: 'https://static.cx.metamask.io/api/v1/tokenIcons/1/0x0000000000000000000000000000000000000000.png' }],
    };

    const fetchCryptoAddress = useCallback(async () => {
        if (!token) return;
        try { const data = await api.getCryptoDepositAddress(token); setCryptoAddress(data.address); } 
        catch (error) { showMessage({ text: error.message, type: 'error' }); }
    }, [token, showMessage]);

    useEffect(() => { fetchCryptoAddress(); }, [fetchCryptoAddress]);
    useEffect(() => { setSelectedToken(depositTokens[selectedNetwork][0].symbol); setQuote(null); }, [selectedNetwork]);

    const handleGetQuote = async () => {
        if (parseFloat(amountUSD) < MINIMUM_USD_DEPOSIT) { showMessage({ text: `Minimum deposit is $${MINIMUM_USD_DEPOSIT.toFixed(2)}.`, type: 'error' }); return; }
        setIsQuoteLoading(true);
        setQuote(null);
        showMessage({ text: '', type: '' });
        try { const quoteData = await api.getCryptoQuote(parseFloat(amountUSD), selectedNetwork, selectedToken, token); setQuote(quoteData); } 
        catch (error) { showMessage({ text: error.message, type: 'error' }); } 
        finally { setIsQuoteLoading(false); }
    };

    if (!systemStatus?.deposits_crypto?.isEnabled) {
        return <DisabledFeature featureName="deposits_crypto" />;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-4">
                <div className="widget !p-4"><label className="block text-sm font-medium text-gray-400 mb-2">1. Select Network</label><div className="flex bg-gray-800/50 p-1 rounded-lg"><button onClick={() => setSelectedNetwork('ethereum')} className={`flex-1 p-2 rounded-md font-semibold transition-all ${selectedNetwork === 'ethereum' ? 'bg-blue-500/20 text-blue-300' : 'text-gray-400 hover:bg-gray-700/50'}`}>Ethereum</button><button onClick={() => setSelectedNetwork('polygon')} className={`flex-1 p-2 rounded-md font-semibold transition-all ${selectedNetwork === 'polygon' ? 'bg-blue-500/20 text-blue-300' : 'text-gray-400 hover:bg-gray-700/50'}`}>Polygon</button></div></div>
                <div className="widget !p-4"><label className="block text-sm font-medium text-gray-400 mb-2">2. Select Currency</label><div className="space-y-2">{depositTokens[selectedNetwork].map(tokenItem => (<button key={tokenItem.symbol} onClick={() => setSelectedToken(tokenItem.symbol)} className={`w-full p-3 rounded-lg border-2 flex items-center justify-between transition-all ${selectedToken === tokenItem.symbol ? 'border-blue-400 bg-blue-500/10' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'}`}><div className="flex items-center gap-3"><CryptoTokenIcon mainSrc={tokenItem.mainSrc} networkSrc={tokenItem.networkSrc} alt={tokenItem.name} /><div><p className="font-bold text-left text-white">{tokenItem.symbol}</p><p className="text-xs text-left text-gray-400">{tokenItem.name}</p></div></div></button>))}</div></div>
                <div className="widget !p-4"><label htmlFor="crypto-amount-input" className="block text-sm font-medium text-gray-400 mb-2">3. Enter Amount (USD)</label><div className="flex items-center gap-2"><span className="text-gray-400 text-lg">$</span><input id="crypto-amount-input" type="number" value={amountUSD} onChange={e => setAmountUSD(e.target.value)} step="0.01" min={MINIMUM_USD_DEPOSIT} className="form-input !text-xl !font-bold !p-2 flex-grow" /></div><p className="text-xs text-gray-500 mt-1">Minimum: ${MINIMUM_USD_DEPOSIT.toFixed(2)}</p><button onClick={handleGetQuote} disabled={isQuoteLoading || parseFloat(amountUSD) < MINIMUM_USD_DEPOSIT} className="btn btn-primary w-full mt-4">Get Deposit Quote</button></div>
            </div>
            <div className="lg:col-span-2 widget">
                <h3 className="widget-title">4. Send Your Deposit</h3>
                {!quote && !isQuoteLoading && <div className="text-center text-gray-500 py-12"><p>Select a network & currency and enter a deposit amount to generate instructions.</p></div>}
                {isQuoteLoading && <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}
                {quote && <div className="space-y-4 text-center"><p className="text-gray-400">To purchase <strong>{quote.gemAmount.toLocaleString()} Gems</strong>, send the exact amount below to your unique deposit address on the <strong className="text-white uppercase">{quote.network}</strong> network.</p><div className="bg-gray-900 p-4 rounded-lg"><p className="text-sm text-blue-400">Send exactly:</p><p className="text-2xl font-bold text-white tracking-wider">{quote.cryptoAmount} {quote.tokenType}</p></div><div className="bg-gray-900 p-4 rounded-lg"><p className="text-sm text-blue-400">To your EVM address:</p><p className="text-sm font-mono text-white break-all my-2">{cryptoAddress}</p>{cryptoAddress && <QRCode address={cryptoAddress} />}</div><div className="text-xs text-yellow-400">This quote is valid for 15 minutes. Ensure you are sending from a {quote.network} wallet. Do not send funds after the quote has expired.</div></div>}
            </div>
        </div>
    );
};

export default CryptoDeposit;
