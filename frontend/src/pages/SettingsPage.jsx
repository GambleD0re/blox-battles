// frontend/src/pages/SettingsPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { ConfirmationModal } from '../components/Dashboard/Modals';
import CreateTicketModal from '../components/Dashboard/CreateTicketModal';

const SettingsRow = ({ label, value }) => (
    <div className="flex justify-between items-center py-3 border-b border-gray-700">
        <span className="text-gray-400">{label}</span>
        <span className="font-semibold text-white truncate">{value}</span>
    </div>
);

const ToggleSwitch = ({ enabled, onToggle, disabled = false }) => (
    <button onClick={onToggle} disabled={disabled} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-600'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
);

const SettingsCard = ({ title, children }) => (
    <div className="widget"><h3 className="widget-title">{title}</h3><div className="p-1">{children}</div></div>
);

const DangerZoneCard = ({ title, text, buttonText, onAction }) => (
    <div className="bg-red-900/20 border border-red-800 p-4 rounded-lg flex items-center justify-between">
        <div><h4 className="font-bold text-red-300">{title}</h4><p className="text-sm text-gray-400">{text}</p></div>
        <button onClick={onAction} className="btn bg-red-600 hover:bg-red-700 text-white !mt-0">{buttonText}</button>
    </div>
);

const SettingsPage = () => {
    const { user, token, logout, fullRefresh, gameProfiles, appConfig } = useAuth();
    const navigate = useNavigate();
    
    const [message, setMessage] = useState({ text: '', type: '' });
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [isTicketSubmitting, setIsTicketSubmitting] = useState(false);
    const [modalStates, setModalStates] = useState({ unlinkRivals: false, unlinkDiscord: false, deleteAccount: false });

    const rivalsProfile = gameProfiles?.rivals;

    useEffect(() => {
        if (!rivalsProfile) {
            fullRefresh();
        }
    }, [rivalsProfile, fullRefresh]);

    const showMessage = (text, type = 'success') => { setMessage({ text, type }); setTimeout(() => setMessage({ text: '', type: '' }), 5000); };
    const openModal = (modalName) => setModalStates(prev => ({ ...prev, [modalName]: true }));
    const closeModal = (modalName) => setModalStates(prev => ({ ...prev, [modalName]: false }));

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) return showMessage("New passwords do not match.", "error");
        try {
            const result = await api.updatePassword({ currentPassword, newPassword }, token);
            showMessage(result.message, 'success');
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
            fullRefresh();
        } catch (error) { showMessage(error.message, 'error'); }
    };

    const handleNotificationToggle = async () => {
        try {
            await api.updateDiscordNotificationPreference(!user.discord_notifications_enabled, token);
            showMessage('Discord notification preferences updated.', 'success');
            fullRefresh();
        } catch (error) { showMessage(error.message, 'error'); }
    };

    const handleRivalsChallengeToggle = async () => {
        try {
            await api.updateRivalsChallengePreference(!rivalsProfile.accepting_challenges, token);
            showMessage('Rivals challenge preference updated.', 'success');
            fullRefresh();
        } catch (error) { showMessage(error.message, 'error'); }
    };
    
    const handleTicketSubmit = async (ticketData) => {
        setIsTicketSubmitting(true);
        try {
            const result = await api.createSupportTicket(ticketData, token);
            showMessage(result.message, 'success');
            setIsTicketModalOpen(false);
        } catch (error) { showMessage(error.message, 'error'); }
        finally { setIsTicketSubmitting(false); }
    };

    const handleUnlinkRivals = async () => {
        try {
            await api.unlinkRivalsAccount(token);
            showMessage("Rivals account unlinked successfully.", 'success');
            closeModal('unlinkRivals');
            await fullRefresh();
        } catch (error) { showMessage(error.message, 'error'); }
    };

    const handleUnlinkDiscord = async () => {
        try {
            await api.unlinkDiscord(token);
            showMessage("Discord account unlinked successfully.", 'success');
            closeModal('unlinkDiscord');
            await fullRefresh();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    };
    
    const handleConfirmDelete = async () => {
        try {
            await api.deleteAccount(deletePassword, token);
            showMessage("Your account has been permanently deleted.", 'success');
            closeModal('deleteAccount');
            setTimeout(logout, 2000);
        } catch (error) {
            showMessage(error.message, 'error');
        }
    };

    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString() : "Never";

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            {message.text && <div className={`fixed top-5 right-5 p-4 rounded-lg text-white font-bold z-50 ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{message.text}</div>}
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-bold text-white">Settings</h1>
                <button onClick={() => navigate('/dashboard')} className="btn btn-secondary !mt-0">Back to Dashboard</button>
            </header>

            <div className="space-y-8">
                <SettingsCard title="Account Information">
                    <SettingsRow label="Blox Battles Username" value={user.username} />
                    <SettingsRow label="Email Address" value={user.email} />
                    <SettingsRow label="Linked Discord Account" value={user.discord_username || 'Not Linked'} />
                    <SettingsRow label="Member Since" value={formatDate(user.created_at)} />
                    <div className="text-center pt-4 mt-2"><button onClick={() => navigate('/history')} className="btn btn-primary">Transaction History</button></div>
                </SettingsCard>

                <SettingsCard title="Notifications">
                    {user.discord_id ? (
                        <div className="flex justify-between items-center py-3">
                            <div><span className="text-gray-300 font-semibold">Discord DM Notifications</span><p className="text-sm text-gray-500">Receive DMs for challenges, duel status, and more.</p></div>
                            <ToggleSwitch enabled={user.discord_notifications_enabled} onToggle={handleNotificationToggle} />
                        </div>
                    ) : (
                        <div className="text-center p-4">
                            <p className="text-gray-400 mb-4">Link your Discord to get important notifications.</p>
                            <a href={appConfig?.discordInviteUrl || '#'} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Link on Discord</a>
                            <p className="text-xs text-gray-500 mt-2">Use the <code className="bg-gray-700 p-1 rounded-md">/link</code> command.</p>
                        </div>
                    )}
                </SettingsCard>
                
                <SettingsCard title="Game Settings">
                    {rivalsProfile ? (
                         <div className="flex justify-between items-center py-3">
                            <div><span className="text-gray-300 font-semibold">Allow Incoming Rivals Challenges</span><p className="text-sm text-gray-500">Allow other players to challenge you in Roblox Rivals.</p></div>
                            <ToggleSwitch enabled={rivalsProfile.accepting_challenges} onToggle={handleRivalsChallengeToggle} />
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center p-4">Link a game profile to manage game-specific settings.</p>
                    )}
                </SettingsCard>

                <SettingsCard title="Support">
                    <div className="flex justify-between items-center py-3">
                        <div><span className="text-gray-300 font-semibold">Contact Support</span><p className="text-sm text-gray-500">Need help? Open a ticket to speak with staff.</p></div>
                        <button onClick={() => setIsTicketModalOpen(true)} className="btn btn-primary !mt-0" disabled={!user.discord_id}>{user.discord_id ? 'Create Ticket' : 'Link Discord to Create'}</button>
                    </div>
                </SettingsCard>

                {!user.google_id && <SettingsCard title="Security"><form onSubmit={handleUpdatePassword} className="space-y-4 pt-4"><div className="form-group"><label>Current Password</label><input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className="form-input" /></div><div className="form-group"><label>New Password</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="form-input" /></div><div className="form-group"><label>Confirm New Password</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="form-input" /></div><div className="text-right"><button type="submit" className="btn btn-primary">Update Password</button></div></form></SettingsCard>}

                <SettingsCard title="Danger Zone">
                    <div className="space-y-4">
                        <div className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg flex items-center justify-between"><h4 className="font-bold text-gray-300">Log Out</h4><button onClick={logout} className="btn btn-secondary !mt-0">Log Out</button></div>
                        {rivalsProfile?.linked_game_username && <DangerZoneCard title="Unlink Roblox (Rivals) Account" text={`Linked to ${rivalsProfile.linked_game_username}.`} buttonText="Unlink" onAction={() => openModal('unlinkRivals')} />}
                        {user.discord_id && <DangerZoneCard title="Unlink Discord Account" text={`Linked to ${user.discord_username}.`} buttonText="Unlink" onAction={() => openModal('unlinkDiscord')} />}
                        <DangerZoneCard title="Delete Account" text="This action is permanent and cannot be undone." buttonText="Delete" onAction={() => openModal('deleteAccount')} />
                    </div>
                </SettingsCard>
            </div>

            <CreateTicketModal isOpen={isTicketModalOpen} onClose={() => setIsTicketModalOpen(false)} onSubmit={handleTicketSubmit} isSubmitting={isTicketSubmitting} />
            <ConfirmationModal isOpen={modalStates.unlinkRivals} onClose={() => closeModal('unlinkRivals')} onConfirm={handleUnlinkRivals} title="Unlink Rivals Account?" text="Are you sure? You will need to re-verify to play Rivals again." confirmText="Yes, Unlink" />
            <ConfirmationModal isOpen={modalStates.unlinkDiscord} onClose={() => closeModal('unlinkDiscord')} onConfirm={handleUnlinkDiscord} title="Unlink Discord Account?" text="Are you sure?" confirmText="Yes, Unlink" />
            <ConfirmationModal isOpen={modalStates.deleteAccount} onClose={() => closeModal('deleteAccount')} onConfirm={handleConfirmDelete} title="Delete Your Account?" text="This is permanent and cannot be undone.">{!user.google_id && <div className="mt-4"><label>Enter password to confirm</label><input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} className="form-input" /></div>}</ConfirmationModal>
        </div>
    );
};

export default SettingsPage;
