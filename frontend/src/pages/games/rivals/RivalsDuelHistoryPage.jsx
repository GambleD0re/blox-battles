// frontend/src/pages/games/rivals/RivalsDuelHistoryPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import * as api from '../../../services/api';
import { TranscriptModal } from '../../../components/Dashboard/Modals';

const Loader = () => (
    <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
);

const DuelRow = ({ duel, currentUser, onViewTranscript }) => {
    const isChallenger = duel.challenger_id === currentUser.id;
    const opponent = {
        username: isChallenger ? duel.opponent_username : duel.challenger_username,
        avatar: isChallenger ? duel.opponent_avatar : duel.challenger_avatar,
    };
    const outcome = duel.winner_id === currentUser.id ? 'win' : 'loss';
    const amount = outcome === 'win' ? `+${duel.pot}` : `-${duel.wager}`;
    const amountColor = outcome === 'win' ? 'text-green-400' : 'text-red-400';
    const finalScore = 'N/A'; // This would need transcript data to calculate

    return (
        <div className="flex items-center gap-4 p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <div className={`w-24 text-center font-black text-2xl ${amountColor}`}>{amount}</div>
            <div className="flex-grow flex items-center gap-3">
                <img src={currentUser.avatar_url || 'https://placehold.co/40x40'} alt="You" className="w-10 h-10 rounded-full"/>
                <span className="text-gray-400">vs</span>
                <img src={opponent.avatar || 'https://placehold.co/40x40'} alt={opponent.username} className="w-10 h-10 rounded-full"/>
                <span className="font-semibold text-white">{opponent.username}</span>
            </div>
            <div className="w-24 text-center"><div className="font-bold text-lg">{finalScore}</div><div className="text-xs text-gray-500">Score</div></div>
            <div className="w-32 text-right"><button onClick={() => onViewTranscript(duel.id)} className="btn btn-secondary !mt-0 !py-2 !px-4">Transcript</button></div>
        </div>
    );
};

const RivalsDuelHistoryPage = () => {
    const { user, token, gameProfiles } = useAuth();
    const rivalsProfile = gameProfiles?.rivals;
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedTranscript, setSelectedTranscript] = useState([]);
    const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!token) return;
            try {
                const data = await api.getRivalsDuelHistory(token);
                setHistory(data);
            } catch (err) {
                setError(err.message || 'Failed to fetch duel history.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, [token]);

    const handleViewTranscript = async (duelId) => {
        try {
            const transcriptData = await api.getTranscript(duelId, token);
            setSelectedTranscript(transcriptData.transcript || []);
            setIsTranscriptModalOpen(true);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-bold text-white">Rivals Duel History</h1>
                <button onClick={() => navigate('/games/rivals/dashboard')} className="btn btn-secondary !mt-0">Back to Rivals Dashboard</button>
            </header>
            <div className="widget">
                {error && <div className="p-4 mb-4 text-center bg-red-900/50 text-red-300 rounded-lg">{error}</div>}
                <div className="space-y-3">
                    {isLoading ? <Loader /> : history.length > 0 ? (
                        history.map(duel => <DuelRow key={duel.id} duel={duel} currentUser={rivalsProfile} onViewTranscript={handleViewTranscript} />)
                    ) : (
                        <p className="p-8 text-center text-gray-500">No completed Rivals duels found.</p>
                    )}
                </div>
            </div>
            <TranscriptModal isOpen={isTranscriptModalOpen} onClose={() => setIsTranscriptModalOpen(false)} transcript={selectedTranscript} />
        </div>
    );
};

export default RivalsDuelHistoryPage;
