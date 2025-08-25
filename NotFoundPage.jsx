// frontend/src/pages/NotFoundPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NotFoundPage = () => {
    const { appConfig } = useAuth();

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white text-center p-4">
            <h1 className="text-8xl font-black text-blue-500">404</h1>
            <h2 className="mt-4 text-3xl font-bold">Page Not Found</h2>
            <p className="mt-2 text-lg text-gray-400">
                Sorry, we couldn't find the page you were looking for.
            </p>
            <div className="mt-8 flex items-center gap-4">
                <Link to="/dashboard" className="btn btn-secondary !mt-0 !bg-gray-700 hover:!bg-gray-600">
                    Go to Dashboard
                </Link>
                <a 
                    href={appConfig?.discordInviteUrl || '#'}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-primary !mt-0 !bg-blue-600 hover:!bg-blue-700"
                >
                    Join our Discord
                </a>
            </div>
        </div>
    );
};

export default NotFoundPage;
