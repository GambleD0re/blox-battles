// frontend/src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import UserActionsModal from '../components/Admin/UserActionsModal';
import { ConfirmationModal, TranscriptModal } from '../components/Dashboard/Modals';

const StatCard = ({ title, value, icon }) => (
    <div className="widget flex items-center p-4 gap-4">
        <div className="text-3xl">{icon}</div>
        <div>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-sm text-gray-400">{title}</div>
        </div>
    </div>
);

const UserRow = ({ user, onSelectUser }) => (
    <tr className="border-b border-gray-700 hover:bg-gray-800/50">
        <td className="p-3"><div className="font-semibold text-white">{user.username}</div><div className="text-xs text-gray-400">{user.email}</div></td>
        <td className="p-3 text-center">{user.gems}</td>
        <td className="p-3 text-center"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.status === 'active' ? 'bg-green-800 text-green-200' : 'bg-red-800 text-red-200'}`}>{user.status.toUpperCase()}</span></td>
        <td className="p-3 text-right"><button onClick={() => onSelectUser(user)} className="btn btn-secondary !mt-0 !py-1 !px-3">Manage</button></td>
    </tr>
);

const AdminDashboard = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [message, setMessage] = useState({ text: '', type: '' });

    const showMessage = (text, type = 'success') => { setMessage({ text, type }); setTimeout(() => setMessage({ text: '', type: '' }), 5000); };
    
    const fetchData = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const [usersData, statsData] = await Promise.all([
                api.getAdminUsers(searchQuery, token, statusFilter),
                api.getAdminStats(token),
            ]);
            setUsers(usersData);
            setStats(statsData);
        } catch (error) { showMessage(error.message, 'error'); } 
        finally { setIsLoading(false); }
    }, [token, searchQuery, statusFilter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleActionComplete = (msg, type) => { showMessage(msg, type); setSelectedUser(null); fetchData(); };

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {message.text && <div className={`fixed top-5 right-5 p-4 rounded-lg text-white font-bold z-50 ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{message.text}</div>}
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>
                <div className="flex items-center gap-4">
                    {user?.is_master_admin && <button onClick={() => navigate('/admin/system-controls')} className="btn bg-yellow-600 hover:bg-yellow-700 text-white !mt-0">System Controls</button>}
                    <button onClick={() => navigate('/dashboard')} className="btn btn-secondary !mt-0">Back to Dashboard</button>
                </div>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Total Users" value={stats.totalUsers} icon="👥" />
                <StatCard title="Gems in Circulation" value={stats.gemsInCirculation?.toLocaleString()} icon="💎" />
                <StatCard title="Pending Payouts" value={stats.pendingPayouts} icon="💸" />
                <StatCard title="Total Tax Collected" value={stats.taxCollected?.toLocaleString()} icon="📈" />
            </div>

            <div className="widget mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="widget-title !mb-0">Game Management</h2>
                    <button onClick={() => navigate('/admin/games/rivals/tournaments/create')} className="btn btn-primary !mt-0">Create Rivals Tournament</button>
                </div>
            </div>

            <div className="widget">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="widget-title !mb-0">User Management</h2>
                    <form onSubmit={(e) => { e.preventDefault(); fetchData(); }} className="flex gap-2">
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-input !w-32"><option value="">All Statuses</option><option value="active">Active</option><option value="banned">Banned</option><option value="terminated">Terminated</option></select>
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="form-input !w-60" />
                        <button type="submit" className="btn btn-primary !mt-0">Search</button>
                    </form>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead><tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-700"><th className="p-3">User</th><th className="p-3 text-center">Gems</th><th className="p-3 text-center">Status</th><th className="p-3"></th></tr></thead>
                        <tbody>{isLoading ? (<tr><td colSpan="4" className="text-center p-8">Loading...</td></tr>) : (users.map(u => <UserRow key={u.id} user={u} onSelectUser={setSelectedUser} />))}</tbody>
                    </table>
                </div>
            </div>

            <UserActionsModal isOpen={!!selectedUser} onClose={() => setSelectedUser(null)} user={selectedUser} token={token} onActionComplete={handleActionComplete}/>
        </div>
    );
};

export default AdminDashboard;
