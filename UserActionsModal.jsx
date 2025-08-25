// frontend/src/components/Admin/UserActionsModal.jsx
import React, { useState } from 'react';
import * as api from '../../services/api';
import { Modal } from '../Dashboard/Modals';

const UserActionsModal = ({ user, isOpen, onClose, onActionComplete, token }) => {
    const [gemAmount, setGemAmount] = useState(0);
    const [banReason, setBanReason] = useState('');
    const [banDuration, setBanDuration] = useState(24);

    if (!user) return null;

    const handleGemUpdate = async (e) => { e.preventDefault(); try { await api.updateUserGems(user.id, parseInt(gemAmount, 10), token); onActionComplete(`Gems updated for ${user.username}.`); } catch (error) { onActionComplete(error.message, 'error'); }};
    const handleBan = async (e) => { e.preventDefault(); try { await api.banUser(user.id, banReason, banDuration, token); onActionComplete(`${user.username} has been banned.`); } catch (error) { onActionComplete(error.message, 'error'); }};
    const handleUnban = async () => { try { await api.unbanUser(user.id, token); onActionComplete(`${user.username} has been unbanned.`); } catch (error) { onActionComplete(error.message, 'error'); }};
    const handleDelete = async () => { if (window.confirm(`Are you sure you want to terminate ${user.username}?`)) { try { await api.deleteUserAccount(user.id, token); onActionComplete(`${user.username} has been terminated.`); } catch (error) { onActionComplete(error.message, 'error'); }}};

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Manage User: ${user.username}`}>
            {/* Gem Management */}
            <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                <h4 className="font-bold text-lg mb-2">Modify Gems</h4>
                <form onSubmit={handleGemUpdate} className="flex items-end gap-3">
                    <div className="flex-grow"><label className="text-sm text-gray-400">Add or Remove Gems</label><input type="number" value={gemAmount} onChange={e => setGemAmount(e.target.value)} className="form-input" placeholder="e.g., 100 or -50" /></div>
                    <button type="submit" className="btn btn-primary !mt-0">Update Gems</button>
                </form>
            </div>

            {/* Ban Management */}
            <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700 mt-4">
                <h4 className="font-bold text-lg mb-2">Ban Management</h4>
                {user.status === 'banned' ? (
                    <div className="flex justify-between items-center"><p className="text-red-400">This user is currently banned.</p><button onClick={handleUnban} className="btn btn-primary !mt-0">Unban</button></div>
                ) : (
                    <form onSubmit={handleBan} className="space-y-3">
                        <div><label className="text-sm text-gray-400">Reason</label><input type="text" value={banReason} onChange={e => setBanReason(e.target.value)} required className="form-input" /></div>
                        <div><label className="text-sm text-gray-400">Duration (hours, leave empty for permanent)</label><input type="number" value={banDuration} onChange={e => setBanDuration(e.target.value)} className="form-input" /></div>
                        <button type="submit" className="btn bg-yellow-600 text-white w-full">Apply Ban</button>
                    </form>
                )}
            </div>

            {/* Account Termination */}
            <div className="p-4 rounded-lg bg-red-900/30 border border-red-700 mt-4">
                 <div className="flex justify-between items-center">
                    <div><h4 className="font-bold text-lg text-red-300">Terminate Account</h4><p className="text-sm text-red-400">This is permanent and cannot be undone.</p></div>
                    <button onClick={handleDelete} className="btn bg-red-600 text-white !mt-0">Terminate</button>
                </div>
            </div>
        </Modal>
    );
};

export default UserActionsModal;
