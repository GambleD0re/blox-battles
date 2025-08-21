// frontend/src/components/games/rivals/Inbox.jsx
import React from 'react';

const DuelNotification = ({ duel, onStartDuel }) => {
    return (
        <div className="duel-item">
            <div className="flex-grow">
                <p className="font-semibold">{duel.type === 'incoming' ? `From: ${duel.challenger_username}` : `To: ${duel.opponent_username}`}</p>
                <p className="text-sm text-gray-400">Wager: {duel.wager} Gems | Map: {duel.map_name}</p>
                {duel.status === 'accepted' && <p className="text-sm text-yellow-400">Status: Accepted - Ready to Start</p>}
                {duel.status === 'started' && <p className="text-sm text-green-400">Status: Started - Join Now!</p>}
            </div>
            
            <div className="flex items-center gap-2">
                {duel.status === 'accepted' && (
                    <button onClick={() => onStartDuel(duel)} className="btn btn-primary">Start</button>
                )}
                {duel.status === 'started' && (
                    <a href={duel.server_invite_link || '#'} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Join Server</a>
                )}
            </div>
        </div>
    );
};

const Inbox = ({ notifications, onStartDuel }) => {
    
    const renderNotification = (notification) => {
        if (notification.type === 'duel') {
            return (
                <DuelNotification 
                    key={notification.id}
                    duel={notification.data}
                    onStartDuel={() => onStartDuel(notification.data)}
                />
            );
        }
        // Other notification types can be added here
        return null;
    };

    return (
        <div className="widget flex-grow flex flex-col">
            <h2 className="widget-title flex-shrink-0">Rivals Inbox</h2>
            <div className="space-y-3 overflow-y-auto">
                {notifications && notifications.length > 0 ? (
                    notifications.map(renderNotification)
                ) : (
                    <p className="text-gray-500 text-center py-4">Your Rivals inbox is empty.</p>
                )}
            </div>
        </div>
    );
};

export default Inbox;
