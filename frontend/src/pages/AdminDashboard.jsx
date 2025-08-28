// frontend/src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import UserActionsModal from '../components/Admin/UserActionsModal';
import { TranscriptModal } from '../components/Dashboard/Modals';
import { AdminPayoutDetailModal, DeclineModal } from '../components/Admin/AdminPayoutModals';

const UsersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const GemsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="m12 22 4-13-3-6"/><path d="M12 22 8 9l3-6"/></svg>;
const DisputesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9.09 9 5.82 5.82"/><path d="m14.91 9-5.82 5.82"/></svg>;
const PayoutsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 12h5a2 2 0 0 1 0 4h-5a2 2 0 0 1 0-4Z"/><path d="M8 7H3a2 2 0 0 0 0 4h5a2 2 0 0 0 0-4Z"/><path d="M12 17V7"/></svg>;

const StatCard = ({ title, value, icon, color }) => (
    <div className="widget flex items-center p-4 gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
            {icon}
        </div>
        <div>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-sm text-gray-400">{title}</div>
        </div>
    </div>
);

const UserRow = ({ user, onSelectUser }) => (
    <tr className="border-b border-gray-800 hover:bg-gray-800/50">
        <td className="p-3"><div className="font-semibold text-white">{user.username}</div><div className="text-xs text-gray-500">{user.email}</div></td>
        <td className="p-3 text-center font-mono">{user.gems.toLocaleString()}</td>
        <td className="p-3 text-center"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.status === 'active' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{user.status.toUpperCase()}</span></td>
        <td className="p-3 text-right"><button onClick={() => onSelectUser(user)} className="btn btn-secondary !mt-0 !py-1 !px-3">Manage</button></td>
    </tr>
);

const DisputeResolutionModal = ({ isOpen, onClose, dispute, onResolve, onViewTranscript }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
            <div className="widget w-full max-w-2xl">
                <header className="p-4 border-b border-gray-700 flex justify-between items-center"><h2 className="text-xl font-bold">Review Dispute #{dispute.id}</h2><button onClick={onClose}>×</button></header>
                <div className="p-6 space-y-4">
                    <p><strong>Game:</strong> {dispute.game_name}</p>
                    <p><strong>Reporter:</strong> {dispute.reporter_username}</p>
                    <p><strong>Reported:</strong> {dispute.reported_username}</p>
                    <p><strong>Reason:</strong> <p className="p-2 bg-gray-900 rounded-md mt-1">{dispute.reason}</p></p>
                    <button onClick={() => onViewTranscript(dispute.duel_id)} className="btn btn-secondary w-full !mt-4">View Duel Transcript</button>
                </div>
                <footer className="p-4 border-t border-gray-700 grid grid-cols-3 gap-2">
                    <button onClick={() => onResolve(dispute.id, 'uphold_winner')} className="btn btn-primary">Uphold Win</button>
                    <button onClick={() => onResolve(dispute.id, 'overturn_to_reporter')} className="btn bg-yellow-600 text-white">Overturn</button>
                    <button onClick={() => onResolve(dispute.id, 'void_refund')} className="btn btn-secondary">Void & Refund</button>
                </footer>
            </div>
        </div>
    );
};

const AdminDashboard = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({});
    const [disputes, setDisputes] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedDispute, setSelectedDispute] = useState(null);
    const [transcript, setTranscript] = useState(null);
    const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const showMessage = (text, type = 'success') => { setMessage({ text, type }); setTimeout(() => setMessage({ text: '', type: '' }), 5000); };
    
    const fetchData = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const [usersData, statsData, disputesData] = await Promise.all([
                api.getAdminUsers(searchQuery, statusFilter, token),
                api.getAdminStats(token),
                api.getAdminDisputes(token)
            ]);
            setUsers(usersData);
            setStats(statsData);
            setDisputes(disputesData);
        } catch (error) { showMessage(error.message, 'error'); } 
        finally { setIsLoading(false); }
    }, [token, searchQuery, statusFilter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleActionComplete = (msg, type) => { showMessage(msg, type); setSelectedUser(null); fetchData(); };
    const handleResolveDispute = async (id, type) => { try { await api.resolveDispute(id, type, token); showMessage('Dispute resolved.', 'success'); setSelectedDispute(null); fetchData(); } catch (e) { showMessage(e.message, 'error'); }};
    const handleViewTranscript = async (id) => { try { const data = await api.getTranscript(id, token); setTranscript(data); setIsTranscriptModalOpen(true); } catch (e) { showMessage(e.message, 'error'); }};
    
    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {message.text && <div className={`fixed top-5 right-5 p-4 rounded-lg text-white z-50 ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{message.text}</div>}
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>
                <div className="flex items-center gap-4">
                    {user?.is_master_admin && <button onClick={() => navigate('/admin/system-controls')} className="btn bg-yellow-600 hover:bg-yellow-700 text-white !mt-0">System Controls</button>}
                    <button onClick={() => navigate('/dashboard')} className="btn btn-secondary !mt-0">Back to Dashboard</button>
                </div>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Total Users" value={stats.totalUsers || 0} icon={<UsersIcon />} color="bg-blue-500/20 text-blue-300" />
                <StatCard title="Gems in Circulation" value={stats.gemsInCirculation?.toLocaleString() || 0} icon={<GemsIcon />} color="bg-purple-500/20 text-purple-300" />
                <StatCard title="Pending Disputes" value={stats.pendingDisputes || 0} icon={<DisputesIcon />} color="bg-yellow-500/20 text-yellow-300" />
                <StatCard title="Pending Payouts" value={stats.pendingPayouts || 0} icon={<PayoutsIcon />} color="bg-green-500/20 text-green-300" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch">
                <div className="widget flex flex-col">
                    <h2 className="widget-title flex-shrink-0">Pending Disputes</h2>
                    <div className="overflow-x-auto flex-grow">
                        <table className="w-full">
                            <thead><tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-800"><th className="p-3">Duel ID</th><th className="p-3">Reporter vs Reported</th><th className="p-3">Reason</th><th className="p-3"></th></tr></thead>
                            <tbody>
                                {isLoading ? (<tr><td colSpan="4" className="text-center p-8 text-gray-500">Loading...</td></tr>) 
                                : disputes.length > 0 ? (disputes.map(d => (
                                    <tr key={d.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                                        <td className="p-3 font-mono text-gray-400">#{d.duel_id}</td>
                                        <td className="p-3"><div className="font-semibold text-green-400">{d.reporter_username}</div><div className="text-xs text-gray-500">vs</div><div className="font-semibold text-red-400">{d.reported_username}</div></td>
                                        <td className="p-3 text-sm text-gray-300 max-w-xs truncate" title={d.reason}>{d.reason}</td>
                                        <td className="p-3 text-right"><button onClick={() => setSelectedDispute(d)} className="btn btn-primary !mt-0 !py-1 !px-3">Review</button></td>
                                    </tr>
                                ))) : (<tr><td colSpan="4" className="text-center p-8 text-gray-500">No pending disputes.</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="widget flex flex-col">
                    <div className="flex justify-between items-center mb-4 flex-shrink-0">
                        <h2 className="widget-title !mb-0">User Management</h2>
                        <form onSubmit={(e) => { e.preventDefault(); fetchData(); }} className="flex gap-2">
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-input !w-32"><option value="">All</option><option value="active">Active</option><option value="banned">Banned</option><option value="terminated">Terminated</option></select>
                            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="form-input !w-60" />
                            <button type="submit" className="btn btn-primary !mt-0">Search</button>
                        </form>
                    </div>
                    <div className="overflow-x-auto flex-grow">
                        <table className="w-full">
                            <thead><tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-800"><th className="p-3">User</th><th className="p-3 text-center">Gems</th><th className="p-3 text-center">Status</th><th className="p-3"></th></tr></thead>
                            <tbody>{isLoading ? (<tr><td colSpan="4" className="text-center p-8 text-gray-500">Loading...</td></tr>) : (users.map(u => <UserRow key={u.id} user={u} onSelectUser={setSelectedUser} />))}</tbody>
                        </table>
                    </div>
                </div>
            </div>

            <UserActionsModal isOpen={!!selectedUser} onClose={() => setSelectedUser(null)} user={selectedUser} token={token} onActionComplete={handleActionComplete}/>
            <DisputeResolutionModal isOpen={!!selectedDispute} onClose={() => setSelectedDispute(null)} dispute={selectedDispute} onResolve={handleResolveDispute} onViewTranscript={handleViewTranscript} />
            <TranscriptModal isOpen={isTranscriptModalOpen} onClose={() => setIsTranscriptModalOpen(false)} transcript={transcript?.transcript} />
        </div>
    );
};

export default AdminDashboard;
