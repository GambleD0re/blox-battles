// frontend/src/components/games/rivals/RivalsPlayerHeader.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82-.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V15a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>;
const AdminIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>;
const MenuIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>;

const RivalsPlayerHeader = ({ user, rivalsProfile, onMenuClick }) => {
    const navigate = useNavigate();

    if (!user || !rivalsProfile) return null;

    return (
        <header className="dashboard-header !p-4">
            <div className="player-info !gap-4">
                <button 
                    onClick={onMenuClick} 
                    className="flex items-center justify-center w-12 h-12 rounded-lg bg-gray-900/50 border border-gray-700 text-gray-400 hover:text-white hover:border-blue-500 transition-colors"
                    title="Open Menu"
                >
                    <MenuIcon />
                </button>
                <img src={rivalsProfile.avatar_url || 'https://placehold.co/60x60/161b22/7d8590?text=R'} alt="Avatar" className="player-avatar !w-16 !h-16" />
                <div>
                    <h1 className="player-name !text-2xl">{rivalsProfile.linked_game_username}</h1>
                    <p className="player-id !text-xs">BloxBattles: {user.username}</p>
                </div>
            </div>
            <div className="player-stats">
                <button onClick={() => navigate('/deposit')} className="stat-item gems transition-transform transform hover:scale-105" title="Go to Deposit Page">
                    <span className="stat-value !text-2xl">{user.gems.toLocaleString()}</span>
                    <span className="stat-label">Gems</span>
                </button>
                <div className="stat-item wins">
                    <span className="stat-value !text-2xl">{rivalsProfile.wins}</span>
                    <span className="stat-label">Rivals Wins</span>
                </div>
                <div className="stat-item losses">
                    <span className="stat-value !text-2xl">{rivalsProfile.losses}</span>
                    <span className="stat-label">Rivals Losses</span>
                </div>
                <button onClick={() => navigate('/settings')} className="btn-settings" title="Settings"><SettingsIcon /></button>
                {user.is_admin && <button onClick={() => navigate('/admin')} className="btn-settings" title="Admin"><AdminIcon /></button>}
            </div>
        </header>
    );
};

export default RivalsPlayerHeader;```

### `frontend/src/components/games/rivals/ChallengePlayer.jsx`

The `ChallengePlayer` component, now moved into the new directory structure. It uses the `findRivalsPlayer` API endpoint.

```jsx
// frontend/src/components/games/rivals/ChallengePlayer.jsx
import React, { useState } from 'react';
import * as api from '../../../services/api';

const ChallengePlayer = ({ token, onChallenge, onError, isBanned }) => {
    const [username, setUsername] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleFindPlayer = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setSearchResult(null);
        try {
            const foundPlayer = await api.findRivalsPlayer(username, token);
            setSearchResult(
                <div className="flex justify-between items-center">
                    <p>Found player: <strong>{foundPlayer.linked_game_username}</strong></p>
                    <button onClick={() => onChallenge(foundPlayer)} className="btn-primary !mt-0 !w-auto !py-1 !px-3 !text-sm">Challenge</button>
                </div>
            );
        } catch (error) {
            setSearchResult(<p className="text-[var(--loss-color)]">{error.message}</p>);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="widget">
            <h2 className="widget-title">Challenge a Player</h2>
            <form onSubmit={handleFindPlayer}>
                <div className="form-group mb-4">
                    <label htmlFor="player-search-input" className="block text-sm font-medium text-gray-400 mb-1">Opponent's Roblox Username</label>
                    <div className="flex items-center gap-2">
                        <input id="player-search-input" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username..." required className="form-input flex-grow" disabled={isBanned} />
                        <button type="submit" className="btn btn-primary !mt-0 w-1/4" disabled={isLoading || isBanned}>
                            {isLoading ? '...' : 'Find'}
                        </button>
                    </div>
                </div>
            </form>
            {searchResult && <div className="mt-4 p-3 bg-gray-900 rounded-lg border border-gray-700">{searchResult}</div>}
        </div>
    );
};

export default ChallengePlayer;
