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

const ToggleSwitch = ({ enabled, onToggle }) => (
    <button onClick={onToggle} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-600'}`}>
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
    const { user, token, logout, refreshUser, gameProfiles, refreshGameProfile, appConfig } = useAuth();
    const navigate = useNavigate();
    
    const [message, setMessage] = useState({ text: '', type: '' });
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [isTicketSubmitting, setIsTicketSubmitting] = useState(false);
    const [modalStates, setModalStates] = useState({ unlinkRivals: false, unlinkDiscord: false, deleteAccount: false });

    const rivalsProfile = gameProfiles?.rivals;

    useEffect(() => {
        refreshGameProfile('rivals');
    }, []);

    const showMessage = (text, type) => { setMessage({ text, type }); setTimeout(() => setMessage({ text: '', type: '' }), 5000); };
    const openModal = (modalName) => setModalStates(prev => ({ ...prev, [modalName]: true }));
    const closeModal = (modalName) => setModalStates(prev => ({ ...prev, [modalName]: false }));

    const handleUpdatePassword = async (e) => { /* ... unchanged logic ... */ };
    const handleTicketSubmit = async (ticketData) => { /* ... unchanged logic ... */ };
    
    const handleUnlinkRivals = async () => {
        try {
            await api.unlinkRivalsAccount(token);
            showMessage("Rivals account unlinked successfully.", 'success');
            closeModal('unlinkRivals');
            await refreshGameProfile('rivals');
            navigate('/dashboard'); // Go back to main dash after unlinking
        } catch (error) { showMessage(error.message, 'error'); }
    };

    const handleUnlinkDiscord = async () => { /* ... unchanged logic ... */ };
    const handleConfirmDelete = async () => { /* ... unchanged logic ... */ };

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

                {/* ... other settings cards (Privacy, Support, Notifications) unchanged ... */}

                {!user.google_id && (
                    <SettingsCard title="Security">
                        {/* ... password update form unchanged ... */}
                    </SettingsCard>
                )}

                <SettingsCard title="Danger Zone">
                    <div className="space-y-4">
                        <div className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg flex items-center justify-between">
                            <h4 className="font-bold text-gray-300">Log Out</h4>
                            <button onClick={logout} className="btn btn-secondary !mt-0">Log Out</button>
                        </div>
                        {rivalsProfile && <DangerZoneCard title="Unlink Roblox (Rivals) Account" text={`Linked to ${rivalsProfile.linked_game_username}.`} buttonText="Unlink" onAction={() => openModal('unlinkRivals')} />}
                        {user.discord_id && <DangerZoneCard title="Unlink Discord Account" text={`Linked to ${user.discord_username}.`} buttonText="Unlink" onAction={() => openModal('unlinkDiscord')} />}
                        <DangerZoneCard title="Delete Account" text="This action is permanent and cannot be undone." buttonText="Delete" onAction={() => openModal('deleteAccount')} />
                    </div>
                </SettingsCard>
            </div>

            <CreateTicketModal isOpen={isTicketModalOpen} onClose={() => setIsTicketModalOpen(false)} onSubmit={handleTicketSubmit} isSubmitting={isTicketSubmitting} />
            <ConfirmationModal isOpen={modalStates.unlinkRivals} onClose={() => closeModal('unlinkRivals')} onConfirm={handleUnlinkRivals} title="Unlink Rivals Account?" text="Are you sure? You will need to re-verify your Roblox account to play Rivals again." confirmText="Yes, Unlink" />
            <ConfirmationModal isOpen={modalStates.unlinkDiscord} onClose={() => closeModal('unlinkDiscord')} onConfirm={handleUnlinkDiscord} title="Unlink Discord Account?" text="Are you sure? You can re-link your account later using the /link command." confirmText="Yes, Unlink" />
            <ConfirmationModal isOpen={modalStates.deleteAccount} onClose={() => closeModal('deleteAccount')} onConfirm={handleConfirmDelete} title="Delete Your Account?" text="This is permanent and cannot be undone. All duel history and gems will be lost.">{!user.google_id && <div className="mt-4"><label>Enter password to confirm</label><input type="password" onChange={(e) => setDeletePassword(e.target.value)} className="form-input" /></div>}</ConfirmationModal>
        </div>
    );
};

export default SettingsPage;
