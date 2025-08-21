// frontend/src/pages/BanNotice.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';

const BanNotice = () => {
    const { user, logout, appConfig } = useAuth();

    const isPermanent = !user.ban_expires_at;
    const banExpiresDate = user.ban_expires_at ? new Date(user.ban_expires_at) : null;
    const now = new Date();
    const daysRemaining = (d1, d2) => d1 && d2 ? Math.ceil((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
            <div className="w-full max-w-2xl p-8 space-y-6 bg-gray-800/50 rounded-xl shadow-lg border-2 border-red-700 text-center">
                <h1 className="text-4xl font-black text-red-500">Account Banned</h1>
                <p className="text-lg text-yellow-300">
                    {isPermanent ? 
                        <b>If you believe this is a mistake, please open a ban appeal ticket in our Discord.</b> :
                        `Your access will be restored in approximately ${daysRemaining(banExpiresDate, now)} days.`
                    }
                </p>
                <div className="text-left bg-gray-900 p-4 rounded-lg space-y-3">
                    <p><b>Ban Reason:</b> {user.ban_reason || 'No reason provided.'}</p>
                    {banExpiresDate && <p><b>Ban Expires:</b> {banExpiresDate.toLocaleString()}</p>}
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                    <a href={appConfig?.discordInviteUrl || '#'} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition">
                        Join Discord
                    </a>
                    <button onClick={logout} className="w-full sm:w-auto px-8 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition">
                        Log Out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BanNotice;
