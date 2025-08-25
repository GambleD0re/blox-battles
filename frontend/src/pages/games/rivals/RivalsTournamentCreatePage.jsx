// frontend/src/pages/games/rivals/RivalsTournamentCreatePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import * as api from '../../../services/api';

const RivalsTournamentCreatePage = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [gameData, setGameData] = useState({ maps: [], weapons: [], regions: [] });
    const [message, setMessage] = useState({ text: '', type: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [tournament, setTournament] = useState({
        name: '', region: 'NA-East', assigned_bot_id: '', private_server_link: '',
        buy_in_amount: 100, prize_pool_gems: 5000, registration_opens_at: '', starts_at: '',
        prize_distribution: { '1': 2500, '2': 1500, '3': 1000 },
        rules: { map_pool: [], banned_weapons: [] },
    });

    useEffect(() => {
        api.getRivalsGameData(token).then(setGameData).catch(err => setMessage({ text: err.message, type: 'error' }));
    }, [token]);

    const handleChange = (e) => setTournament(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleRulesChange = (type, id) => setTournament(prev => ({...prev, rules: {...prev.rules, [type]: prev.rules[type].includes(id) ? prev.rules[type].filter(i => i !== id) : [...prev.rules[type], id]}}));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage({ text: '', type: '' });
        try {
            const dataToSubmit = { ...tournament, buy_in_amount: parseInt(tournament.buy_in_amount), prize_pool_gems: parseInt(tournament.prize_pool_gems) };
            const result = await api.createRivalsTournament(dataToSubmit, token); // Using new API function
            setMessage({ text: result.message, type: 'success' });
            setTimeout(() => navigate('/admin'), 2000);
        } catch (err) {
            setMessage({ text: err.message, type: 'error' });
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            {message.text && <div className={`mb-6 p-4 rounded-lg text-white ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{message.text}</div>}
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-bold text-white">Create New Rivals Tournament</h1>
                <button onClick={() => navigate('/admin')} className="btn btn-secondary !mt-0">Back to Admin</button>
            </header>
            <form onSubmit={handleSubmit} className="widget space-y-6">
                {/* ... Form JSX remains unchanged ... */}
            </form>
        </div>
    );
};

export default RivalsTournamentCreatePage;
