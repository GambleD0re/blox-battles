// frontend/src/pages/MainDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import PlayerHeader from '../components/Dashboard/PlayerHeader';
import LiveFeed from '../components/Dashboard/LiveFeed';
import SidebarMenu from '../components/Dashboard/SidebarMenu';

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
    const { user, token } = useAuth();
    const [games, setGames] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        if (!token) {
            return;
        }

        const fetchGames = async () => {
            setIsLoading(true);
            try {
                const gamesData = await api.getGames(token);
                setGames(gamesData);
            } catch (error) {
                console.error("Failed to fetch games:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchGames();
    }, [token]);

    return (
        <>
            <SidebarMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
            
            <PlayerHeader user={user} onMenuClick={() => setIsMenuOpen(true)} />

            <main className="mt-8">
                <div className="widget">
                    <h2 className="widget-title">Discover Games</h2>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-48">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="flex justify-center gap-6 overflow-x-auto pb-4">
                            {games.length > 0 ? (
                                games.map(game => <GameCard key={game.id} game={game} />)
                            ) : (
                                <p className="text-gray-500 text-center w-full">No games are currently available.</p>
                            )}
                        </div>
                    )}
                </div>
            </main>
            
            <LiveFeed token={token} />
        </>
    );
};

export default MainDashboard;
