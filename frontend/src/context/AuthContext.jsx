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
                api.getGames(tokenToUse)
            ]);
            
            setSystemStatus(statusData);
            setAppConfig(configData);
            setUser({ ...userData, isAdmin: decoded.isAdmin, isMasterAdmin: decoded.isMasterAdmin, is_username_set: decoded.is_username_set });

            const profilePromises = gamesData.map(game => {
                if (game.id === 'rivals') {
                    return api.getRivalsGameProfile(tokenToUse).then(profile => ({ gameId: 'rivals', profile }));
                }
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
            console.error("Failed to fetch user data, logging out.", error);
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

    const fullRefresh = useCallback(async () => {
       const tokenFromStorage = localStorage.getItem('token');
       if (!tokenFromStorage) {
           logout();
           return;
       }
       await fetchAndSetAllData(tokenFromStorage);
    }, [logout, fetchAndSetAllData]);

    useEffect(() => {
        const initializeAuth = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const urlToken = urlParams.get('token');

            try {
                if (urlToken) {
                    window.history.replaceState({}, document.title, window.location.pathname);
                    await login(urlToken);
                } else {
                    const existingToken = localStorage.getItem('token');
                    if (existingToken) {
                        const decoded = jwtDecode(existingToken);
                        if (decoded.exp * 1000 < Date.now()) {
                            logout();
                        } else {
                            setToken(existingToken);
                            await fetchAndSetAllData(existingToken);
                        }
                    }
                }
            } catch (e) {
                console.error("Initialization error:", e);
                logout();
            } finally {
                setIsLoading(false);
            }
        };
        initializeAuth();
    }, []);

    const value = { user, gameProfiles, token, systemStatus, appConfig, login, logout, isLoading, fullRefresh };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
