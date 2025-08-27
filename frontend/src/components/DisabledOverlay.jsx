// frontend/src/components/DisabledOverlay.jsx
import React from 'react';

const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
);

const DisabledOverlay = ({ message }) => {
    return (
        <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 rounded-xl z-10">
            <div className="w-12 h-12 bg-yellow-600/20 text-yellow-400 rounded-full flex items-center justify-center mb-4 border border-yellow-500">
                <LockIcon />
            </div>
            <h4 className="text-lg font-bold text-yellow-300">Feature Unavailable</h4>
            <p className="text-sm text-gray-300">{message}</p>
        </div>
    );
};

export default DisabledOverlay;
