// frontend/src/pages/games/rivals/RivalsLinkPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import * as api from '../../../services/api';

const RivalsLinkPage = () => {
    const { user, token, refreshGameProfile } = useAuth();
    const navigate = useNavigate();
    const [robloxUsername, setRobloxUsername] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // Note: This assumes the verification phrase is part of the game profile.
    // We might need to fetch it separately if it's not already loaded.
    const verificationPhrase = user?.gameProfiles?.rivals?.verification_phrase || 'Loading phrase...';

    const handleVerify = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: '', type: '' });
        try {
            const data = await api.verifyRivalsAccount(robloxUsername, token);
            setMessage({ text: data.message, type: 'success' });
            await refreshGameProfile('rivals');
            
            setTimeout(() => {
                navigate('/games/rivals/dashboard');
            }, 1500);

        } catch (err) {
            setMessage({ text: err.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const copyPhrase = () => {
        if (verificationPhrase && verificationPhrase !== 'Loading phrase...') {
            navigator.clipboard.writeText(verificationPhrase);
            setMessage({ text: 'Copied to clipboard!', type: 'success' });
            setTimeout(() => setMessage(prev => (prev.text === 'Copied to clipboard!' ? {text: '', type: ''} : prev)), 2000);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
            <div className="w-full max-w-lg p-8 space-y-6 bg-[var(--widget-bg)] rounded-xl shadow-lg border border-[var(--widget-border)] text-center">
                <h1 className="text-3xl font-bold text-white">Link Your Roblox Account for Rivals</h1>
                <p className="text-gray-400">To play Rivals, you must first verify ownership of your Roblox account.</p>
                
                {message.text && <div className={`p-3 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{message.text}</div>}

                <div className="text-left space-y-2">
                    <p className="text-gray-300">1. Copy the unique phrase below.</p>
                    <p className="text-gray-300">2. Paste it into your Roblox profile's "About" section.</p>
                    <p className="text-gray-300">3. Enter your Roblox username below and click "Verify".</p>
                </div>

                <div className="bg-gray-900 border border-dashed border-gray-600 p-4 rounded-lg font-mono text-[var(--accent-color)] cursor-pointer" onClick={copyPhrase}>
                    {verificationPhrase}
                </div>

                <form onSubmit={handleVerify}>
                    <div className="mb-4 text-left">
                        <label className="block text-sm font-medium text-gray-300 mb-1">Your Roblox Username</label>
                        <input type="text" value={robloxUsername} onChange={e => setRobloxUsername(e.target.value)} required className="form-input" placeholder="Enter your Roblox username..." />
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition disabled:opacity-50 flex items-center justify-center">
                        {isLoading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Verify & Play Rivals'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default RivalsLinkPage;
