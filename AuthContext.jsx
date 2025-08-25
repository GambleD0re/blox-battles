// frontend/src/context/AuthContext.jsx
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import * as api from '../services/api';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [gameProfiles, setGameProfiles] = useState({});
    const [token, setToken] = useState(null);
    const [systemStatus, setSystemStatus] = useState(null);
    const [appConfig, setAppConfig] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setGameProfiles({});
    }, []);

    const fetchAndSetAllData = useCallback(async (tokenToUse) => {
        try {
            const decoded = jwtDecode(tokenToUse);
            const [statusData, configData, userData, gamesData] = await Promise.all([
                api.getFeatureStatus(),
                api.getAppConfig(),
                api.getCoreUserData(tokenToUse),
                api.getGames(tokenToUse) // Fetch available games
            ]);
            setSystemStatus(statusData);
            setAppConfig(configData);
            setUser({ ...userData, isAdmin: decoded.isAdmin, is_username_set: decoded.is_username_set });

            // [FIX] After setting the core user, fetch all their game profiles
            const profilePromises = gamesData.map(game => {
                if (game.id === 'rivals') {
                    return api.getRivalsGameProfile(tokenToUse).then(profile => ({ gameId: 'rivals', profile }));
                }
                // In the future, other game profile fetches would be added here
                return Promise.resolve(null);
            });

            const profilesResults = await Promise.allSettled(profilePromises);
            const newGameProfiles = {};
            profilesResults.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    newGameProfiles[result.value.gameId] = result.value.profile;
                }
            });
            setGameProfiles(newGameProfiles);

        } catch (error) {
            console.error("Failed to fetch initial data, logging out.", error);
            logout();
        }
    }, [logout]);
    
    const login = useCallback(async (newToken) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
        setIsLoading(true);
        await fetchAndSetAllData(newToken);
        setIsLoading(false);
    }, [fetchAndSetAllData]);

    useEffect(() => {
        const initializeAuth = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const urlToken = urlParams.get('token');

            if (urlToken) {
                window.history.replaceState({}, document.title, window.location.pathname);
                await login(urlToken);
            } else {
                const existingToken = localStorage.getItem('token');
                if (existingToken) {
                    try {
                        const decoded = jwtDecode(existingToken);
                        if (decoded.exp * 1000 < Date.now()) {
                            logout();
                        } else {
                            setToken(existingToken);
                            await fetchAndSetAllData(existingToken);
                        }
                    } catch (e) {
                        logout();
                    }
                }
            }
            setIsLoading(false);
        };
        initializeAuth();
    }, [login, logout, fetchAndSetAllData]);
    
    const refreshUser = useCallback(async () => {
       const tokenFromStorage = localStorage.getItem('token');
       if (!tokenFromStorage) {
           logout();
           return;
       }
       try {
           const decoded = jwtDecode(tokenFromStorage);
           const newUserData = await api.getCoreUserData(tokenFromStorage);
           setUser(prevUser => ({ ...prevUser, ...newUserData, isAdmin: decoded.isAdmin, is_username_set: decoded.is_username_set }));
       } catch (error) {
           console.error("Failed to refresh user data:", error);
           logout();
       }
    }, [logout]);
    
    const refreshGameProfile = useCallback(async (gameId) => {
        const tokenFromStorage = localStorage.getItem('token');
        if (!tokenFromStorage || !gameId) return;
        try {
            let profileData;
            if (gameId === 'rivals') {
                profileData = await api.getRivalsGameProfile(tokenFromStorage);
            }
            if (profileData) {
                setGameProfiles(prev => ({ ...prev, [gameId]: profileData }));
            }
        } catch (error) {
            if (error.response?.status !== 404) {
                 console.error(`Failed to refresh game profile for ${gameId}:`, error);
            } else {
                 setGameProfiles(prev => ({ ...prev, [gameId]: null }));
            }
        }
    }, []);

    const value = { user, gameProfiles, token, systemStatus, appConfig, login, logout, isLoading, refreshUser, refreshGameProfile };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
