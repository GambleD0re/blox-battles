// frontend/src/pages/SetUsernamePage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';
import DisabledOverlay from '../components/DisabledOverlay';

const SetUsernamePage = () => {
    const { token, login, logout, systemStatus } = useAuth();
    const [username, setUsername] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const registrationStatus = systemStatus?.user_registration;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const parts = birthDate.split('/');
        if (parts.length !== 3 || parts[0].length !== 2 || parts[1].length !== 2 || parts[2].length !== 4) {
            setError('Please enter your date of birth in MM/DD/YYYY format.');
            return;
        }

        const [month, day, year] = parts.map(p => parseInt(p, 10));
        const dob = new Date(year, month - 1, day);

        if (dob.getFullYear() !== year || dob.getMonth() !== month - 1 || dob.getDate() !== day) {
            setError('Please enter a valid date.');
            return;
        }

        const today = new Date();
        const eighteenYearsAgo = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
        if (dob > eighteenYearsAgo) {
            setError('You must be 18 or older to use this service.');
            return;
        }
        
        const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        setIsLoading(true);
        try {
            const data = await api.setUsername(username, formattedDate, token);
            await login(data.token);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
            if (err.response?.status === 403) {
                setTimeout(() => {
                    logout();
                    navigate('/signup');
                }, 3000);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-15rem)]">
            <div className="w-full max-w-md p-8 space-y-8 bg-[var(--widget-bg)] rounded-xl shadow-lg border border-[var(--widget-border)] text-center relative">
                {!registrationStatus?.isEnabled && <DisabledOverlay message={registrationStatus?.message} />}
                <h1 className="text-3xl font-bold text-white">Welcome to Blox Battles!</h1>
                <p className="text-gray-400">
                    Choose your unique username and confirm your age to complete registration.
                </p>
                
                {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-lg">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-6 text-left">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">Username</label>
                        <input 
                            id="username" 
                            type="text" 
                            value={username} 
                            onChange={e => setUsername(e.target.value)} 
                            required 
                            className="form-input" 
                            placeholder="e.g., BloxDuelist123" 
                            minLength="3"
                            maxLength="20"
                            disabled={!registrationStatus?.isEnabled}
                        />
                        <p className="text-xs text-gray-500 mt-1">3-20 characters. Letters, numbers, and underscores only.</p>
                    </div>
                    <div>
                        <label htmlFor="birthDate" className="block text-sm font-medium text-gray-300 mb-1">Date of Birth</label>
                        <input 
                            id="birthDate" 
                            type="text" 
                            value={birthDate} 
                            onChange={e => setBirthDate(e.target.value)} 
                            required 
                            className="form-input"
                            placeholder="MM/DD/YYYY"
                            disabled={!registrationStatus?.isEnabled}
                        />
                         <p className="text-xs text-gray-500 mt-1">You must be 18 or older to use this service.</p>
                    </div>
                    <button 
                        type="submit" 
                        disabled={isLoading || !registrationStatus?.isEnabled} 
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition disabled:opacity-50 flex items-center justify-center"
                    >
                        {isLoading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Confirm & Enter'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SetUsernamePage;
