// frontend/src/pages/DepositPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import XsollaDeposit from '../components/Payments/XsollaDeposit';
import CryptoDeposit from '../components/Payments/CryptoDeposit';

const TabButton = ({ active, onClick, children }) => (
    <button onClick={onClick} className={`px-4 py-2 font-semibold rounded-t-lg border-b-2 transition-colors ${active ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
        {children}
    </button>
);

const DepositPage = () => {
    const { refreshUser } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [message, setMessage] = useState({ text: '', type: '' });
    const [activeTab, setActiveTab] = useState('xsolla');

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

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {message.text && <div className={`mb-6 p-4 rounded-lg text-white font-bold ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{message.text}</div>}
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-bold text-white">Deposit Gems</h1>
                <button onClick={() => navigate('/dashboard')} className="btn btn-secondary !mt-0">Back to Dashboard</button>
            </header>

            <div className="border-b border-gray-700 mb-6">
                <TabButton active={activeTab === 'xsolla'} onClick={() => setActiveTab('xsolla')}>Alternative Payments</TabButton>
                <TabButton active={activeTab === 'crypto'} onClick={() => setActiveTab('crypto')}>Cryptocurrency</TabButton>
            </div>

            <div className="mt-6">
                {activeTab === 'xsolla' && <XsollaDeposit showMessage={setMessage} />}
                {activeTab === 'crypto' && <CryptoDeposit showMessage={setMessage} />}
            </div>
        </div>
    );
};

export default DepositPage;
