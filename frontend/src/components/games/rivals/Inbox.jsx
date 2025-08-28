// frontend/src/components/games/rivals/Inbox.jsx
import React from 'react';

const DuelNotification = ({ duel, onStartDuel, onViewDuel }) => {
    return (
        <div className="duel-item">
            <div className="flex-grow">
                <p className="font-semibold">{duel.type === 'incoming' ? `From: ${duel.challenger_username}` : `To: ${duel.opponent_username}`}</p>
                <p className="text-sm text-gray-400">Wager: {duel.wager} Gems | Map: {duel.map_name}</p>
                {duel.status === 'pending' && <p className="text-sm text-yellow-400">Status: Awaiting your response</p>}
                {duel.status === 'accepted' && <p className="text-sm text-yellow-400">Status: Accepted - Ready to Start</p>}
                {duel.status === 'started' && <p className="text-sm text-green-400">Status: Started - Join Now!</p>}
            </div>
            
            <div className="flex items-center gap-2">
                 {duel.type === 'incoming' && duel.status === 'pending' && (
                    <button onClick={() => onViewDuel(duel)} className="btn btn-primary">View</button>
                )}
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

const WithdrawalNotification = ({ request, onConfirm, onCancel }) => {
    const { status, amount_gems } = request;
    return (
        <div className="duel-item">
             <div className="flex-grow">
                <p className="font-semibold">Withdrawal Request</p>
                <p className="text-sm text-gray-400">Amount: {amount_gems.toLocaleString()} Gems</p>
                {status === 'awaiting_approval' && <p className="text-sm text-yellow-400">Status: Awaiting admin approval</p>}
                {status === 'approved' && <p className="text-sm text-green-400">Status: Approved - Ready to confirm</p>}
            </div>
            <div className="flex items-center gap-2">
                {status === 'awaiting_approval' && (
                    <button onClick={() => onCancel(request.id)} className="btn btn-danger">Cancel</button>
                )}
                {status === 'approved' && (
                    <button onClick={() => onConfirm(request.id)} className="btn btn-primary">Confirm</button>
                )}
            </div>
        </div>
    );
};

const Inbox = ({ notifications, onStartDuel, onViewDuel, onConfirmWithdrawal, onCancelWithdrawal }) => {
    
    const renderNotification = (notification) => {
        switch (notification.type) {
            case 'duel':
                return (
                    <DuelNotification 
                        key={notification.id}
                        duel={notification.data}
                        onStartDuel={() => onStartDuel(notification.data)}
                        onViewDuel={() => onViewDuel(notification.data)}
                    />
                );
            case 'withdrawal_request':
                return (
                    <WithdrawalNotification
                        key={notification.id}
                        request={notification.data}
                        onConfirm={onConfirmWithdrawal}
                        onCancel={onCancelWithdrawal}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="widget flex-grow flex flex-col">
            <h2 className="widget-title flex-shrink-0">Dashboard Inbox</h2>
            <div className="flex-grow space-y-3 overflow-y-auto">
                {notifications && notifications.length > 0 ? (
                    notifications.map(renderNotification)
                ) : (
                    <p className="text-gray-500 text-center py-4">Your inbox is empty.</p>
                )}
            </div>
        </div>
    );
};

export default Inbox;
