// frontend/src/components/Payments/DisabledFeature.jsx
import React from 'react';
import { useAuth } from '../../context/AuthContext';

const DisabledFeature = ({ featureName }) => {
    const { systemStatus } = useAuth();
    const status = systemStatus?.[featureName];

    return (
        <div className="widget max-w-lg mx-auto text-center">
             <div className="p-8 space-y-4">
                <h1 className="text-3xl font-black text-yellow-400">Feature Unavailable</h1>
                <p className="text-lg text-gray-300">
                    {status?.message || 'This payment method is temporarily disabled. Please check back later.'}
                </p>
            </div>
        </div>
    );
};

export default DisabledFeature;
