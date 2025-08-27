// frontend/src/components/MainLayout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';

const MainLayout = () => {
    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-28">
            <Outlet />
        </div>
    );
};

export default MainLayout;
