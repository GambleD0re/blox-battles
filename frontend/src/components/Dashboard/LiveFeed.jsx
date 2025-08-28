// frontend/src/components/Dashboard/LiveFeed.jsx
import React, { useState, useEffect, useRef } from 'react';

const DuelCard = ({ duel }) => {
    const { winner, loser, score, pot } = duel;

    const formatGems = (amount) => {
        if (amount >= 1000) {
            return `${(amount / 1000).toFixed(1)}k`;
        }
        return amount.toString();
    };
    
    return (
        <div className="flex-shrink-0 w-full h-20 bg-gray-900/60 border border-gray-700 rounded-lg p-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <img src={winner.avatarUrl || `https://ui-avatars.com/api/?name=${winner.username.charAt(0)}&background=2d3748&color=e2e8f0`} alt={winner.username} className="w-14 h-14 object-cover rounded-full border-2 border-green-400" />
                <span className="font-bold text-white text-lg truncate">{winner.username}</span>
            </div>
            <div className="text-center flex-shrink-0 mx-4">
                <div className="font-black text-2xl text-white">{score ? Object.values(score).join(' - ') : 'N/A'}</div>
                <div className="font-bold text-sm text-green-400">{formatGems(pot)} Gems</div>
            </div>
            <div className="flex items-center justify-end gap-3 flex-1 min-w-0">
                <span className="font-bold text-white text-lg truncate text-right">{loser.username}</span>
                <img src={loser.avatarUrl || `https://ui-avatars.com/api/?name=${loser.username.charAt(0)}&background=2d3748&color=e2e8f0`} alt={loser.username} className="w-14 h-14 object-cover rounded-full border-2 border-gray-600" />
            </div>
        </div>
    );
};

const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>;
const ChevronUpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>;

const LiveFeed = ({ token, onMatchFound, onInboxRefresh }) => {
    const [duels, setDuels] = useState([]);
    const [isVisible, setIsVisible] = useState(() => localStorage.getItem('liveFeedVisible') !== 'false');
    const ws = useRef(null);

    const toggleVisibility = () => {
        setIsVisible(prev => {
            localStorage.setItem('liveFeedVisible', !prev);
            return !prev;
        });
    };
    
    const onNewDuel = (duelData) => {
        const newDuel = { key: `duel-${duelData.id}-${Date.now()}`, position: 'enter', data: duelData };
        setDuels(currentDuels => [
            newDuel,
            ...currentDuels.map(d => {
                const newPosition = d.position === 'slot1' ? 'slot2' : 'exit';
                return { ...d, position: newPosition };
            })
        ]);
    };

    useEffect(() => {
        if (!token) return;
        const connect = () => {
            const wsUrl = (import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(/^http/, 'ws');
            ws.current = new WebSocket(wsUrl);

            ws.current.onopen = () => ws.current.send(JSON.stringify({ type: 'auth', token }));
            ws.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'live_feed_history') {
                    const displayableHistory = data.payload.slice(0, 2);
                    setDuels(displayableHistory.map((duelData, i) => ({ key: `hist-${duelData.id}`, position: i === 0 ? 'slot1' : 'slot2', data: duelData })));
                } else if (data.type === 'live_feed_update') {
                    onNewDuel(data.payload);
                } else if (data.type === 'match_found' && onMatchFound) {
                    onMatchFound(data.payload);
                } else if (data.type === 'inbox_refresh_request' && onInboxRefresh) {
                    onInboxRefresh();
                }
            };
            ws.current.onclose = () => setTimeout(connect, 5000);
        };
        connect();
        return () => ws.current?.close();
    }, [token, onMatchFound, onInboxRefresh]);

    useEffect(() => {
        const enterTimer = setTimeout(() => setDuels(current => current.map(d => d.position === 'enter' ? {...d, position: 'slot1'} : d)), 100);
        const exitTimer = setTimeout(() => setDuels(current => current.filter(d => d.position !== 'exit')), 800);
        return () => { clearTimeout(enterTimer); clearTimeout(exitTimer); };
    }, [duels]);
    
    return (
        <div className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="max-w-screen-2xl mx-auto relative px-4 sm:px-6 lg:px-8">
                <button onClick={toggleVisibility} className="absolute left-4 -top-6 w-12 h-6 bg-gray-800/80 backdrop-blur-md border-t border-l border-r border-gray-700 rounded-t-lg flex items-center justify-center text-gray-400 hover:text-white" title={isVisible ? 'Hide Feed' : 'Show Feed'}>
                    {isVisible ? <ChevronDownIcon /> : <ChevronUpIcon />}
                </button>
            </div>
            <div className="h-24 bg-black/60 backdrop-blur-md border-t-2 border-gray-800">
                <div className="max-w-screen-2xl mx-auto h-full flex items-center overflow-hidden">
                    <div className="flex-shrink-0 w-12 flex items-center justify-center"><span className="text-purple-400 font-black text-xl tracking-tighter" style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>LIVE</span></div>
                    <div className="flex-grow h-full"><div className="live-feed-cards-container">{duels.map(d => <div key={d.key} className={`duel-card-wrapper pos-${d.position}`}><DuelCard duel={d.data} /></div>)}</div></div>
                    <div className="flex-shrink-0 w-12 flex items-center justify-center"><span className="text-yellow-300 font-black text-xl tracking-tighter" style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>FEED</span></div>
                </div>
            </div>
        </div>
    );
};

export default LiveFeed;
