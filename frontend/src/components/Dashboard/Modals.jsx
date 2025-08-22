// frontend/src/components/Dashboard/Modals.jsx
import React, { useState, useEffect } from 'react';

const CloseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;

export const Modal = ({ children, isOpen, onClose, title }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
            <div className="widget w-full max-w-2xl max-h-[90vh] flex flex-col relative">
                <header className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-100">{title}</h2>
                    {onClose && <button onClick={onClose} className="text-gray-400 hover:text-white"><CloseIcon /></button>}
                </header>
                <div className="p-6 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
};

export const MatchReadyModal = ({ isOpen, onJoin, onClose, duelDetails, currentUser }) => {
    if (!isOpen || !duelDetails || !currentUser) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
            <div className="widget w-full max-w-lg text-center">
                <h2 className="text-4xl font-black text-green-400 mb-2">Match Found!</h2>
                <p className="text-lg text-gray-300">Your duel is starting now. Join before the timer runs out!</p>
                <div className="vs-card">
                    <div className="player-display">
                        <img src={currentUser.avatar_url || 'https://placehold.co/70x70'} alt="You" />
                        <h4>{currentUser.linked_game_username}</h4>
                    </div>
                    <div className="vs-text">VS</div>
                    <div className="player-display">
                         <img src={duelDetails.opponent?.avatarUrl || 'https://placehold.co/70x70'} alt={duelDetails.opponent?.username} />
                        <h4>{duelDetails.opponent?.username}</h4>
                    </div>
                </div>
                <div className="mt-6 flex flex-col sm:flex-row gap-4">
                    <button onClick={onClose} className="btn btn-secondary w-full">Close</button>
                    <button onClick={onJoin} className="btn btn-primary w-full text-lg">
                        Join Server
                    </button>
                </div>
            </div>
        </div>
    );
};

export const PostDuelModal = ({ isOpen, result, currentUser, onConfirm, onDispute }) => {
    const [view, setView] = useState('result');
    const [reason, setReason] = useState('');
    const [hasVideo, setHasVideo] = useState(false);

    const isWinner = result?.winner_id === currentUser?.id;
    const opponentUsername = isWinner ? result?.loser_username : result?.winner_username;

    useEffect(() => {
        if (isOpen) {
            setView('result');
            setReason('');
            setHasVideo(false);
        }
    }, [isOpen, result]);

    if (!isOpen || !result) return null;

    const handleDisputeSubmit = (e) => {
        e.preventDefault();
        onDispute(result.id, { reason, has_video_evidence: hasVideo });
    };

    return (
        <Modal isOpen={isOpen} title="Duel Results">
            {view === 'result' && (
                <div className="text-center">
                    <h3 className={`text-5xl font-black mb-2 ${isWinner ? 'text-green-400' : 'text-red-500'}`}>{isWinner ? 'VICTORY' : 'DEFEAT'}</h3>
                    <p className="text-gray-300">vs <span className="font-bold">{opponentUsername}</span>.</p>
                    <p className={`text-lg font-bold mt-4 ${isWinner ? 'text-green-400' : 'text-red-500'}`}>{isWinner ? '+' : '-'}{result.wager} Gems</p>
                    <div className="modal-actions mt-6">
                        <button onClick={() => setView('dispute')} className="btn btn-secondary">Dispute Outcome</button>
                        <button onClick={() => onConfirm(result.id)} className="btn btn-primary">Confirm Result</button>
                    </div>
                </div>
            )}
            {view === 'dispute' && (
                <form onSubmit={handleDisputeSubmit}>
                    <h3 className="text-2xl font-bold text-center mb-4">File a Dispute</h3>
                    <p className="text-gray-400 text-center mb-6">Provide a reason for the dispute. An admin will review the case.</p>
                    <div className="form-group"><label>Reason</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} required className="form-input !h-24"></textarea></div>
                    <div className="form-group"><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={hasVideo} onChange={(e) => setHasVideo(e.target.checked)} /><span>I have video evidence</span></label></div>
                    <div className="modal-actions mt-6"><button type="button" onClick={() => setView('result')} className="btn btn-secondary">Back</button><button type="submit" className="btn btn-danger">Submit Dispute</button></div>
                </form>
            )}
        </Modal>
    );
};

export const ChallengeModal = ({ isOpen, onClose, opponent, currentUser, gameData, onChallengeSubmit, onError }) => {
    const [wager, setWager] = useState(100);
    const [selectedMap, setSelectedMap] = useState('');
    const [bannedWeapons, setBannedWeapons] = useState([]);
    const [selectedRegion, setSelectedRegion] = useState('NA-West');

    useEffect(() => { if (isOpen) { setWager(100); setSelectedMap(''); setBannedWeapons([]); setSelectedRegion('NA-West'); } }, [isOpen]);
    if (!opponent || !currentUser) return null;
    const handleWeaponToggle = (weaponId) => setBannedWeapons(p => p.includes(weaponId) ? p.filter(id => id !== weaponId) : [...p, weaponId]);
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedMap) { return onError("Please select a map."); }
        onChallengeSubmit({ opponent_id: opponent.user_id, wager: parseInt(wager, 10), rules: { map: selectedMap, banned_weapons: bannedWeapons, region: selectedRegion } });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create a Rivals Duel">
            <form onSubmit={handleSubmit} className="space-y-6">
                 {/* Form content remains the same, just ensure it uses `currentUser.linked_game_username` etc. */}
            </form>
        </Modal>
    );
};

export const DuelDetailsModal = ({ isOpen, onClose, duel, onRespond, isViewingOnly = false }) => {
    if (!duel?.data) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isViewingOnly ? "Duel Details" : "Incoming Challenge!"}>
            {/* Modal content remains the same */}
        </Modal>
    );
};

export const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, text, confirmText, children }) => {
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="p-2">
                <p className="text-gray-300">{text}</p>
                {children}
                <div className="modal-actions">
                    <button onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button onClick={onConfirm} className="btn btn-danger">{confirmText || 'Confirm'}</button>
                </div>
            </div>
        </Modal>
    );
};

export const TranscriptModal = ({ isOpen, onClose, transcript }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Duel Transcript">
        <div className="space-y-2 font-mono text-sm max-h-[60vh] overflow-y-auto bg-black rounded-lg p-3 border border-gray-700">
            {transcript && transcript.length > 0 ? transcript.map((event, index) => (
                <pre key={index} className="p-3 rounded bg-gray-900 border border-gray-800 whitespace-pre-wrap break-words">{JSON.stringify(event, null, 2)}</pre>
            )) : <p className="text-center text-gray-500 p-4">No events recorded.</p>}
        </div>
    </Modal>
);
