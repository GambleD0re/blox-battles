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
            <button onClick={() => onRespond(notification.id, 'decline')} className="btn btn-danger !py-1 !px-3 !text-sm !mt-0">Decline</button>
            <button onClick={() => onRespond(notification.id, 'confirm')} className="btn btn-primary !py-1 !px-3 !text-sm !mt-0">Confirm</button>
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
                return null;
        }
    };
    
    const actionableNotifications = notifications.filter(n => n.type === 'discord_link_request' || n.type === 'withdrawal_request');

    return (
        <div className="widget flex flex-col">
            <h2 className="widget-title flex-shrink-0">Dashboard Inbox</h2>
            <div className="flex-grow space-y-2 overflow-y-auto">
                {actionableNotifications.length > 0 ? (
                    actionableNotifications.map(renderNotification)
                ) : (
                    <p className="text-gray-500 text-center py-4">You have no pending actions.</p>
                )}
            </div>
        </div>
    );
};

export default MainInbox;
