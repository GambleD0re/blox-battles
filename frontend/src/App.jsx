// frontend/src/App.jsx
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import FeatureGuard from './components/FeatureGuard.jsx';

// Core Pages
import SignInPage from './pages/SignInPage.jsx';
import SignUpPage from './pages/SignUpPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import ForbiddenPage from './pages/ForbiddenPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import VerificationNoticePage from './pages/VerificationNoticePage.jsx';
import BanNotice from './pages/BanNotice.jsx';
import TranscriptViewerPage from './pages/TranscriptViewerPage.jsx';
import TicketTranscriptViewerPage from './pages/TicketTranscriptViewerPage.jsx';
import SetUsernamePage from './pages/SetUsernamePage.jsx'; // New page import

// Lazy-loaded Core Pages
const MainDashboard = lazy(() => import('./pages/MainDashboard.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const DepositPage = lazy(() => import('./pages/DepositPage.jsx'));
const WithdrawPage = lazy(() => import('./pages/WithdrawPage.jsx'));
const TransactionHistoryPage = lazy(() => import('./pages/TransactionHistoryPage.jsx'));
const DuelHistoryPage = lazy(() => import('./pages/DuelHistoryPage.jsx'));

// Lazy-loaded Game-Specific Pages (Rivals)
const RivalsDashboard = lazy(() => import('./pages/games/rivals/RivalsDashboard.jsx'));
const RivalsLinkPage = lazy(() => import('./pages/games/rivals/RivalsLinkPage.jsx'));
const RivalsTournamentCreatePage = lazy(() => import('./pages/games/rivals/RivalsTournamentCreatePage.jsx'));

// Lazy-loaded Admin Pages
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const AdminSystemControlsPage = lazy(() => import('./pages/AdminSystemControlsPage.jsx'));

const Loader = ({ fullScreen = false }) => (
    <div className={`flex items-center justify-center ${fullScreen ? 'h-screen w-screen bg-gray-900' : 'h-full w-full'}`}>
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
);

const ProtectedRoute = ({ children, requireGameProfile = null }) => {
    const { user, gameProfiles } = useAuth();
    const location = useLocation();

    if (!user) return <Navigate to="/signin" state={{ from: location }} replace />;

    // [NEW] Force user to set a username if they haven't yet.
    if (!user.is_username_set && location.pathname !== '/set-username') {
        return <Navigate to="/set-username" replace />;
    }

    if (!user.google_id && !user.is_email_verified) return <Navigate to="/verification-notice" state={{ email: user.email }} replace />;
    
    if (requireGameProfile && !gameProfiles?.[requireGameProfile]?.linked_game_username) {
        return <Navigate to={`/games/${requireGameProfile}/link`} replace />;
    }

    return children;
};

const AdminRoute = ({ children, masterOnly = false }) => {
    const { user } = useAuth();
    if (!user?.is_admin || (masterOnly && !user.is_master_admin)) {
        return <Navigate to="/forbidden" replace />;
    }
    return children;
};

const App = () => {
    const { user, systemStatus, isLoading } = useAuth();

    if (isLoading) return <Loader fullScreen />;
    if (systemStatus?.site_wide_maintenance && !systemStatus.site_wide_maintenance.isEnabled && !user?.is_master_admin) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white"><div className="text-center p-8 bg-gray-800 rounded-lg shadow-xl"><h1 className="text-4xl font-bold text-yellow-400">Under Maintenance</h1><p className="mt-4 text-lg">{systemStatus.site_wide_maintenance.message}</p></div></div>;
    }
    if (user && user.status === 'banned') return <Suspense fallback={<Loader fullScreen />}><BanNotice /></Suspense>;

    return (
        <ErrorBoundary>
            <Suspense fallback={<Loader fullScreen />}>
                <Routes>
                    <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/signin" />} />
                    <Route path="/signin" element={!user ? <SignInPage /> : <Navigate to="/dashboard" />} />
                    <Route path="/signup" element={!user ? <SignUpPage /> : <Navigate to="/dashboard" />} />
                    <Route path="/verify-email" element={<VerifyEmailPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/verification-notice" element={<VerificationNoticePage />} />
                    <Route path="/forbidden" element={<ForbiddenPage />} />

                    <Route path="/set-username" element={<ProtectedRoute><SetUsernamePage /></ProtectedRoute>} />

                    <Route path="/dashboard" element={<ProtectedRoute><MainDashboard /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                    <Route path="/deposit" element={<ProtectedRoute><FeatureGuard featureName="deposits"><DepositPage /></FeatureGuard></ProtectedRoute>} />
                    <Route path="/withdraw" element={<ProtectedRoute><FeatureGuard featureName="withdrawals"><WithdrawPage /></FeatureGuard></ProtectedRoute>} />
                    <Route path="/history" element={<ProtectedRoute><TransactionHistoryPage /></ProtectedRoute>} />
                    <Route path="/duel-history" element={<ProtectedRoute><DuelHistoryPage /></ProtectedRoute>} />

                    <Route path="/games/rivals/link" element={<ProtectedRoute><RivalsLinkPage /></ProtectedRoute>} />
                    <Route path="/games/rivals/dashboard" element={<ProtectedRoute requireGameProfile="rivals"><RivalsDashboard /></ProtectedRoute>} />
                    
                    <Route path="/transcripts/:duelId" element={<TranscriptViewerPage />} />
                    <Route path="/transcripts/ticket/:ticketId" element={<TicketTranscriptViewerPage />} />
                    
                    <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminDashboard /></AdminRoute></ProtectedRoute>} />
                    <Route path="/admin/system-controls" element={<ProtectedRoute><AdminRoute masterOnly={true}><AdminSystemControlsPage /></AdminRoute></ProtectedRoute>} />
                    <Route path="/admin/games/rivals/tournaments/create" element={<ProtectedRoute><AdminRoute><RivalsTournamentCreatePage /></AdminRoute></ProtectedRoute>} />
                    
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </Suspense>
        </ErrorBoundary>
    );
};

export default App;
