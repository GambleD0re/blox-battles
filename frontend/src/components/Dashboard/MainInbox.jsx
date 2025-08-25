// frontend/src/components/Dashboard/MainInbox.jsx
import React from 'react';

const NotificationItem = ({ children }) => (
    <div className="flex items-center justify-between gap-4 p-3 border-b border-gray-700/50">
        {children}
    </div>
);

const DiscordLinkNotification = ({ notification, onRespond }) => (
    <NotificationItem>
        <div className="flex-grow">
            <p className="font-semibold text-gray-200">Discord Link Request</p>
            <p className="text-sm text-gray-400">Link your account to <span className="font-bold text-gray-300">{notification.data.message}</span>?</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => onRespond(notification.data.id, 'decline')} className="btn btn-danger !py-1 !px-3 !text-sm !mt-0">Decline</button>
            <button onClick={() => onRespond(notification.data.id, 'confirm')} className="btn btn-primary !py-1 !px-3 !text-sm !mt-0">Confirm</button>
        </div>
    </NotificationItem>
);

const WithdrawalNotification = ({ notification, onCancel }) => (
    <NotificationItem>
        <div className="flex-grow">
            <p className="font-semibold text-gray-200">Withdrawal Request Pending</p>
            <p className="text-sm text-gray-400">{notification.data.amount_gems.toLocaleString()} Gems to be reviewed by an admin.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => onCancel(notification.data.id)} className="btn btn-danger !py-1 !px-3 !text-sm !mt-0">Cancel</button>
        </div>
    </NotificationItem>
);

const MainInbox = ({ notifications, onRespondToLink, onCancelWithdrawal }) => {
    
    const renderNotification = (notification) => {
        switch (notification.type) {
            case 'discord_link_request':
                return <DiscordLinkNotification key={notification.id} notification={notification} onRespond={onRespondToLink} />;
            case 'withdrawal_request':
                return <WithdrawalNotification key={notification.id} notification={notification} onCancel={onCancelWithdrawal} />;
            default:
                // This can be expanded with more notification types later
                return null;
        }
    };
    
    const actionableNotifications = notifications.filter(n => n.type === 'discord_link_request' || n.type === 'withdrawal_request');

    return (
        <div className="widget flex flex-col">
            <h2 className="widget-title flex-shrink-0">Dashboard Inbox</h2>
            <div className="space-y-2 overflow-y-auto">
                {actionableNotifications.length > 0 ? (
                    actionableNotifications.map(renderNotification)
                ) : (
                    <p className="text-gray-500 text-center py-4">You have no pending actions.</p>
                )}
            </div>
        </div>
    );
};

export default MainInbox;```

#### **Updated File: `frontend/src/pages/MainDashboard.jsx`**
```javascript
// frontend/src/pages/MainDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import PlayerHeader from '../components/Dashboard/PlayerHeader';
import LiveFeed from '../components/Dashboard/LiveFeed';
import SidebarMenu from '../components/Dashboard/SidebarMenu';
import MainInbox from '../components/Dashboard/MainInbox'; // Import the new inbox

const GameCard = ({ game }) => {
    const navigate = useNavigate();
    const handleClick = () => {
        navigate(`/games/${game.id}/dashboard`);
    };

    return (
        <div 
            className="aspect-square w-48 flex-shrink-0 cursor-pointer group"
            onClick={handleClick}
        >
            <div className="w-full h-full bg-gray-800 rounded-xl overflow-hidden transform transition-transform duration-300 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-blue-500/30">
                <img 
                    src={game.icon_url || 'https://via.placeholder.com/512'} 
                    alt={game.name} 
                    className="w-full h-full object-cover" 
                />
            </div>
            <p className="mt-2 text-center font-semibold text-gray-300 truncate transition-colors group-hover:text-white">{game.name}</p>
        </div>
    );
};

const MainDashboard = () => {
    const { user, token, fullRefresh } = useAuth();
    const [games, setGames] = useState([]);
    const [inbox, setInbox] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const showMessage = (text, type = 'success') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 5000);
    };

    const fetchData = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const [gamesData, inboxData] = await Promise.all([
                api.getGames(token),
                api.getInbox(token)
            ]);
            setGames(gamesData);
            setInbox(inboxData);
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
            showMessage(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRespondToLink = async (messageId, response) => {
        try {
            const result = await api.respondToDiscordLink(messageId, response, token);
            showMessage(result.message, 'success');
            await fullRefresh(); // Use full refresh to update user object with discord_id
            await fetchData();   // Re-fetch inbox to remove the notification
        } catch (error) {
            showMessage(error.message, 'error');
        }
    };
    
    const handleCancelWithdrawal = async (requestId) => {
        try {
            const result = await api.cancelWithdrawalRequest(requestId, token);
            showMessage(result.message, 'success');
            await fullRefresh();
            await fetchData();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    };

    return (
        <>
            <SidebarMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
            {message.text && <div className={`fixed top-5 right-5 p-4 rounded-lg text-white font-bold shadow-lg z-50 ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{message.text}</div>}
            
            <PlayerHeader user={user} onMenuClick={() => setIsMenuOpen(true)} />

            <main className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="widget">
                    <h2 className="widget-title">Discover Games</h2>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-48">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="flex justify-center lg:justify-start gap-6 overflow-x-auto pb-4">
                            {games.length > 0 ? (
                                games.map(game => <GameCard key={game.id} game={game} />)
                            ) : (
                                <p className="text-gray-500 text-center w-full">No games are currently available.</p>
                            )}
                        </div>
                    )}
                </div>
                
                <MainInbox 
                    notifications={inbox}
                    onRespondToLink={handleRespondToLink}
                    onCancelWithdrawal={handleCancelWithdrawal}
                />
            </main>
            
            <LiveFeed 
                token={token} 
                onInboxRefresh={fetchData} 
            />
        </>
    );
};

export default MainDashboard;
