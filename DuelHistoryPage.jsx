// frontend/src/pages/DuelHistoryPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { TranscriptModal } from '../components/Dashboard/Modals';

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
    const isWinner = duel.winner_id === currentUser.id;
    const outcomeText = duel.winner_id ? (isWinner ? 'VICTORY' : 'DEFEAT') : 'DRAW';
    const amount = duel.winner_id ? (isWinner ? `+${duel.pot}` : `-${duel.wager}`) : '0';
    const amountColor = duel.winner_id ? (isWinner ? 'text-green-400' : 'text-red-400') : 'text-gray-400';

    return (
        <div className="flex items-center gap-4 p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <div className="flex-shrink-0 w-28 text-center">
                <p className={`font-black text-xl ${amountColor}`}>{outcomeText}</p>
                <p className={`font-mono text-sm ${amountColor}`}>{amount} Gems</p>
            </div>
            <div className="flex-grow flex items-center gap-4">
                <div className="text-center">
                    <img src={duel.game_icon_url || 'https://placehold.co/40x40'} alt={duel.game_name} className="w-10 h-10 rounded-md mx-auto"/>
                    <p className="text-xs text-gray-500 mt-1">{duel.game_name}</p>
                </div>
                <div className="flex items-center gap-2">
                    <img src={isChallenger ? currentUser.avatar_url : opponent.avatar || 'https://placehold.co/40x40'} alt="player1" className="w-10 h-10 rounded-full"/>
                    <span className="font-semibold text-white">{isChallenger ? currentUser.username : opponent.username}</span>
                    <span className="text-gray-400">vs</span>
                    <span className="font-semibold text-white">{isChallenger ? opponent.username : currentUser.username}</span>
                    <img src={isChallenger ? opponent.avatar : currentUser.avatar_url || 'https://placehold.co/40x40'} alt="player2" className="w-10 h-10 rounded-full"/>
                </div>
            </div>
            <div className="w-32 text-right">
                <button onClick={() => onViewTranscript(duel.id)} className="btn btn-secondary !mt-0 !py-2 !px-4">
                    Transcript
                </button>
            </div>
        </div>
    );
};

const DuelHistoryPage = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedTranscript, setSelectedTranscript] = useState(null);
    const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!token) return;
            try {
                const data = await api.getDuelHistory(token);
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
            setSelectedTranscript(transcriptData);
            setIsTranscriptModalOpen(true);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-bold text-white">Duel History</h1>
                <button onClick={() => navigate('/dashboard')} className="btn btn-secondary !mt-0">Back to Dashboard</button>
            </header>

            <div className="widget">
                {error && <div className="p-4 mb-4 text-center bg-red-900/50 text-red-300 rounded-lg">{error}</div>}
                <div className="space-y-3">
                    {isLoading ? <Loader /> : history.length > 0 ? (
                        history.map(duel => <DuelRow key={duel.id} duel={duel} currentUser={user} onViewTranscript={handleViewTranscript} />)
                    ) : (
                        <p className="p-8 text-center text-gray-500">No completed duels found.</p>
                    )}
                </div>
            </div>
            <TranscriptModal isOpen={isTranscriptModalOpen} onClose={() => setIsTranscriptModalOpen(false)} transcript={selectedTranscript?.transcript} />
        </div>
    );
};

export default DuelHistoryPage;
