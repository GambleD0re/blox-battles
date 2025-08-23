// frontend/src/components/games/rivals/QueueConfigForm.jsx
import React, { useState } from 'react';
import * as api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

const QueueConfigForm = ({ gameData, token, showMessage, onQueueJoined }) => {
    const { user, appConfig } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const wagerOptions = appConfig?.queueWagers || [50, 100, 200, 500, 1000];

    const [wager, setWager] = useState(wagerOptions[1] || wagerOptions[0]);
    const [region, setRegion] = useState('NA-East');
    const [bannedMap, setBannedMap] = useState('');
    const [bannedWeapons, setBannedWeapons] = useState([]);

    const handleWeaponToggle = (weaponId) => {
        setBannedWeapons(prev => {
            if (prev.includes(weaponId)) {
                return prev.filter(id => id !== weaponId);
            }
            // [FIXED] Correctly allow selecting a new weapon if the limit hasn't been reached.
            if (prev.length < 2) {
                return [...prev, weaponId];
            }
            // If limit is reached, do nothing (don't add a third weapon).
            return prev;
        });
    };

    const handleJoinQueue = async () => {
        if (!bannedMap) return showMessage('You must select a map to ban.', 'error');
        if (bannedWeapons.length !== 2) return showMessage('You must select exactly 2 weapons to ban.', 'error');
        
        setIsSubmitting(true);
        try {
            const queueData = {
                wager: parseInt(wager, 10),
                preferences: {
                    region,
                    banned_map: bannedMap,
                    banned_weapons: bannedWeapons
                }
            };
            await api.joinRivalsQueue(queueData, token);
            showMessage('You have joined the queue!', 'success');
            onQueueJoined();
        } catch (error) {
            showMessage(error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <div className="space-y-4">
            <div className="form-group">
                <label>Wager</label>
                <div className="flex items-center gap-2">
                    {wagerOptions.map(opt => (
                        <button key={opt} type="button" onClick={() => setWager(opt)} className={`flex-1 p-2 rounded-md border-2 font-semibold transition-all ${wager === opt ? 'border-blue-500 bg-blue-500/20' : 'border-transparent bg-gray-700/50 hover:bg-gray-600/50'}`}>
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
            <div className="form-group">
                <label>Region</label>
                <select value={region} onChange={e => setRegion(e.target.value)} className="form-input">
                    {gameData.regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
            </div>
            <div className="form-group">
                <label>Ban One Map</label>
                <select value={bannedMap} onChange={e => setBannedMap(e.target.value)} className="form-input">
                    <option value="" disabled>Select a map...</option>
                    {gameData.maps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
            </div>
            <div className="form-group">
                <label>Ban Two Weapons ({bannedWeapons.length}/2)</label>
                <div className="grid grid-cols-2 gap-2 p-2 bg-gray-900/50 rounded-lg max-h-40 overflow-y-auto">
                    {gameData.weapons.map(w => (
                        <label key={w.id} className={`p-2 text-sm text-center rounded-md cursor-pointer transition-colors ${bannedWeapons.includes(w.id) ? 'bg-red-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                            <input type="checkbox" checked={bannedWeapons.includes(w.id)} onChange={() => handleWeaponToggle(w.id)} className="hidden" />
                            {w.name}
                        </label>
                    ))}
                </div>
            </div>
            <div className="modal-actions">
                <button onClick={handleJoinQueue} disabled={isSubmitting || user.gems < wager} className="btn btn-primary w-full">
                    {isSubmitting ? 'Joining...' : `Join Queue (${wager} Gems)`}
                </button>
            </div>
        </div>
    );
};

export default QueueConfigForm;
