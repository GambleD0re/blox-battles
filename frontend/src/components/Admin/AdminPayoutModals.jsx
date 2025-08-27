// frontend/src/components/Admin/AdminPayoutModals.jsx
import React, { useState } from 'react';
import { Modal } from '../Dashboard/Modals';

export const AdminPayoutDetailModal = ({ isOpen, onClose, requestDetails, onApprove, onDecline }) => {
    if (!isOpen || !requestDetails) return null;
    const { user, duelHistory, request } = requestDetails;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
            <div className="widget w-full max-w-4xl max-h-[90vh] flex flex-col">
                <header className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold">Review Payout for {user.username}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">×</button>
                </header>
                <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 space-y-4">
                        <div className="p-4 bg-gray-900/50 rounded-lg">
                            <h4 className="font-bold text-lg mb-2">User Info</h4>
                            <p><strong>Username:</strong> {user.username}</p>
                            <p><strong>Email:</strong> {user.email}</p>
                            <p><strong>Member Since:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="p-4 bg-gray-900/50 rounded-lg">
                            <h4 className="font-bold text-lg mb-2">Balance Impact</h4>
                            <p><strong>Balance Before:</strong> {user.balanceBeforeRequest.toLocaleString()} Gems</p>
                            <p className="text-red-400"><strong>Withdrawal:</strong> -{request.amount_gems.toLocaleString()} Gems</p>
                            <p className="border-t border-gray-700 mt-2 pt-2"><strong>Current Balance:</strong> {user.balanceAfterRequest.toLocaleString()} Gems</p>
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <h4 className="font-bold text-lg mb-2">Recent Duel History (Last 50)</h4>
                        <div className="max-h-96 overflow-y-auto pr-2">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-gray-400 uppercase">
                                        <th className="p-2">Game</th>
                                        <th className="p-2">W/L</th>
                                        <th className="p-2">Outcome</th>
                                        <th className="p-2">Wager</th>
                                        <th className="p-2">Tax</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {duelHistory.map(d => (
                                        <tr key={d.id} className="border-b border-gray-800">
                                            <td className="p-2">{d.game_name}</td>
                                            <td className="p-2">{d.wins} / {d.losses}</td>
                                            <td className={`p-2 font-bold ${d.winner_id === user.id ? 'text-green-400' : 'text-red-400'}`}>{d.winner_id === user.id ? 'WIN' : 'LOSS'}</td>
                                            <td className="p-2">{d.wager} Gems</td>
                                            <td className="p-2 text-yellow-400">{d.tax_collected} Gems</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                 <footer className="p-4 border-t border-gray-700 flex justify-end gap-4">
                    <button onClick={() => onDecline(request)} className="btn btn-danger">Decline</button>
                    <button onClick={() => onApprove(request.id)} className="btn btn-primary">Approve</button>
                </footer>
            </div>
        </div>
    );
};

export const DeclineModal = ({ isOpen, onClose, onSubmit }) => {
    const [reason, setReason] = useState('');
    if (!isOpen) return null;

    const handleSubmit = () => {
        if (reason.trim()) {
            onSubmit(reason);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Decline Withdrawal">
            <div className="form-group">
                <label>Reason for declining:</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} className="form-input !h-28" required />
            </div>
            <div className="modal-actions">
                <button onClick={onClose} className="btn btn-secondary">Cancel</button>
                <button onClick={handleSubmit} className="btn btn-danger" disabled={!reason.trim()}>
                    Confirm Decline
                </button>
            </div>
        </Modal>
    );
};
