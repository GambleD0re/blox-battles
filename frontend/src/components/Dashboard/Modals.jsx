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

export const MatchReadyModal = ({ isOpen, onJoin, onClose, duelDetails, currentUser }) => { /* ... unchanged ... */ };

export const PostDuelModal = ({ isOpen, result, currentUser, onConfirm, onDispute }) => { /* ... unchanged ... */ };

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
        onChallengeSubmit({ opponent_id: opponent.id, wager: parseInt(wager, 10), rules: { map: selectedMap, banned_weapons: bannedWeapons, region: selectedRegion } });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create a Rivals Duel">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="vs-card">
                    <div className="player-display"><img src={currentUser.avatar_url} alt="You" /><h4>{currentUser.linked_game_username}</h4></div>
                    <div className="vs-text">VS</div>
                    <div className="player-display"><img src={opponent.avatar_url} alt={opponent.linked_game_username} /><h4>{opponent.linked_game_username}</h4></div>
                </div>
                {/* ... Rest of the form JSX is unchanged ... */}
            </form>
        </Modal>
    );
};

export const DuelDetailsModal = ({ isOpen, onClose, duel, onRespond, isViewingOnly = false }) => { /* ... unchanged ... */ };

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
