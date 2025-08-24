// frontend/src/pages/games/rivals/RivalsDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import * as api from '../../../services/api';

import RivalsPlayerHeader from '../../../components/games/rivals/RivalsPlayerHeader';
import ChallengePlayer from '../../../components/games/rivals/ChallengePlayer';
import Inbox from '../../../components/games/rivals/Inbox';
import QuickMatchWidget from '../../../components/games/rivals/QuickMatchWidget';
import QueueStatusWidget from '../../../components/games/rivals/QueueStatusWidget';
import SidebarMenu from '../../../components/Dashboard/SidebarMenu';
import { ChallengeModal, DuelDetailsModal, ConfirmationModal, TranscriptModal, PostDuelModal, Modal, MatchReadyModal } from '../../../components/Dashboard/Modals';
import LiveFeed from '../../../components/Dashboard/LiveFeed';
import QueueConfigForm from '../../../components/games/rivals/QueueConfigForm';
import FeatureGuard from '../../../components/FeatureGuard'; // [ADDED] Import FeatureGuard

const RivalsDashboard = () => {
    const { user, token, gameProfiles, refreshUser, refreshGameProfile } = useAuth();
    const rivalsProfile = gameProfiles?.rivals;

    const [inbox, setInbox] = useState([]);
    const [gameData, setGameData] = useState({ maps: [], weapons: [], regions: [] });
    const [unseenResults, setUnseenResults] = useState([]);
    const [queueStatus, setQueueStatus] = useState(null);
    const [matchReadyInfo, setMatchReadyInfo] = useState(null);
    
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isChallengeModalOpen, setChallengeModalOpen] = useState(false);
    const [isQueueModalOpen, setQueueModalOpen] = useState(false);
    const [isDetailsModalOpen, setDetailsModalOpen] = useState(false);
    
    const [selectedOpponent, setSelectedOpponent] = useState(null);
    const [selectedDuel, setSelectedDuel] = useState(null);

    const showMessage = (text, type = 'success') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 5000);
    };

    const fetchRivalsData = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            await refreshGameProfile('rivals'); 
            
            const [inboxData, gameData, resultsData, queueData] = await Promise.all([
                api.getInbox(token),
                api.getRivalsGameData(token),
                api.getRivalsUnseenResults(token),
                api.getRivalsQueueStatus(token)
            ]);
            setInbox(inboxData.filter(n => n.game_id === 'rivals' || !n.game_id));
            setGameData(gameData);
            setUnseenResults(resultsData);
            setQueueStatus(queueData);
        } catch (error) {
            showMessage(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [token, refreshGameProfile]);

    useEffect(() => {
        fetchRivalsData();
    }, [fetchRivalsData]);

    const handleChallengePlayer = (opponent) => {
        setSelectedOpponent(opponent);
        setChallengeModalOpen(true);
    };

    const handleViewDuel = (duel) => {
        setSelectedDuel(duel);
        setDetailsModalOpen(true);
    };

    const handleChallengeSubmit = async (challengeData) => {
        try {
            const result = await api.sendRivalsChallenge(challengeData, token);
            showMessage(result.message, 'success');
            setChallengeModalOpen(false);
            fetchRivalsData();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    };

    const handleRespondToDuel = async (duelId, response) => {
        try {
            const result = await api.respondToRivalsDuel(duelId, response, token);
            showMessage(result.message, 'success');
            setDetailsModalOpen(false);
            await refreshUser();
            await fetchRivalsData();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    };

    const handleStartDuel = async (duel) => {
        try {
            const result = await api.startRivalsDuel(duel.id, token);
            showMessage(result.message, 'success');
            fetchRivalsData();
        } catch(error) {
            showMessage(error.message, 'error');
        }
    };
    
    const handleConfirmResult = async (duelId) => {
        try {
            await api.confirmRivalsDuelResult(duelId, token);
            setUnseenResults(prev => prev.filter(r => r.id !== duelId));
            showMessage('Result confirmed!', 'success');
            refreshUser();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    };

    const handleDisputeResult = async (duelId, disputeData) => {
        try {
            const result = await api.fileRivalsDispute(duelId, disputeData, token);
            showMessage(result.message, 'success');
            setUnseenResults(prev => prev.filter(r => r.id !== duelId));
            fetchRivalsData();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    };

    const handleQueueJoined = async () => {
        setQueueModalOpen(false);
        const status = await api.getRivalsQueueStatus(token);
        setQueueStatus(status);
    };
    
    const handleQueueLeft = () => {
        setQueueStatus(null);
    };
    
    const handleMatchFound = (payload) => {
        if (payload.gameId === 'rivals') {
            showMessage('Rivals match found!', 'success');
            setQueueStatus(null);
            setMatchReadyInfo(payload);
        }
    };

    const handleJoinMatch = () => {
        if (matchReadyInfo?.serverLink) {
            window.open(matchReadyInfo.serverLink, '_blank');
        }
        setMatchReadyInfo(null);
        fetchRivalsData();
    };

    if (isLoading || !rivalsProfile) {
        return <div className="flex items-center justify-center min-h-screen"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-28">
            <SidebarMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
            {message.text && <div className={`fixed top-5 right-5 p-4 rounded-lg text-white font-bold shadow-lg z-50 ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{message.text}</div>}
            
            <RivalsPlayerHeader user={user} rivalsProfile={rivalsProfile} onMenuClick={() => setIsMenuOpen(true)} />

            <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <div className="space-y-6">
                    {/* [MODIFIED] Wrapped components in FeatureGuard */}
                    <FeatureGuard featureName="dueling_rivals_direct">
                        <ChallengePlayer token={token} onChallenge={handleChallengePlayer} />
                    </FeatureGuard>
                    <FeatureGuard featureName="dueling_rivals_queue">
                        {queueStatus ? (
                            <QueueStatusWidget queueStatus={queueStatus} token={token} showMessage={showMessage} onQueueLeft={handleQueueLeft} />
                        ) : (
                            <QuickMatchWidget onJoinClick={() => setQueueModalOpen(true)} />
                        )}
                    </FeatureGuard>
                </div>
                <div className="flex">
                    <Inbox 
                        notifications={inbox}
                        onStartDuel={handleStartDuel}
                        onViewDuel={handleViewDuel}
                    />
                </div>
            </main>

            <Modal isOpen={isQueueModalOpen} onClose={() => setQueueModalOpen(false)} title="Configure Rivals Quick Match">
                <QueueConfigForm gameData={gameData} token={token} showMessage={showMessage} onQueueJoined={handleQueueJoined} />
            </Modal>

            <ChallengeModal 
                isOpen={isChallengeModalOpen} 
                onClose={() => setChallengeModalOpen(false)}
                opponent={selectedOpponent}
                currentUser={rivalsProfile}
                gameData={gameData}
                onChallengeSubmit={handleChallengeSubmit}
                onError={(msg) => showMessage(msg, 'error')}
            />

             <DuelDetailsModal 
                isOpen={isDetailsModalOpen} 
                onClose={() => setDetailsModalOpen(false)}
                duel={selectedDuel}
                onRespond={handleRespondToDuel}
            />

            <MatchReadyModal 
                isOpen={!!matchReadyInfo} 
                onJoin={handleJoinMatch} 
                onClose={() => setMatchReadyInfo(null)}
                duelDetails={matchReadyInfo}
                currentUser={rivalsProfile}
            />

            {(unseenResults || []).map(result => (
                <PostDuelModal 
                    key={result.id}
                    isOpen={true}
                    result={result}
                    currentUser={user}
                    onConfirm={handleConfirmResult}
                    onDispute={handleDisputeResult}
                />
            ))}
            
            <LiveFeed 
                token={token} 
                onMatchFound={handleMatchFound} 
                onInboxRefresh={fetchRivalsData} 
            />
        </div>
    );
};

export default RivalsDashboard;
