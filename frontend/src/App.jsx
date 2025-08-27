// frontend/src/App.jsx
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import FeatureGuard from './components/FeatureGuard.jsx';
import MainLayout from './components/MainLayout.jsx';

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
import SetUsernamePage from './pages/SetUsernamePage.jsx';
import TermsOfServicePage from './pages/TermsOfServicePage.jsx';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage.jsx';

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
                    <Route path="/terms-of-service" element={<TermsOfServicePage />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                    <Route path="/transcripts/:duelId" element={<TranscriptViewerPage />} />
                    <Route path="/transcripts/ticket/:ticketId" element={<TicketTranscriptViewerPage />} />

                    <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                        <Route path="/set-username" element={<SetUsernamePage />} />
                        <Route path="/dashboard" element={<MainDashboard />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/deposit" element={<FeatureGuard featureName="deposits_stripe"><DepositPage /></FeatureGuard>} />
                        <Route path="/withdraw" element={<FeatureGuard featureName="withdrawals_crypto"><WithdrawPage /></FeatureGuard>} />
                        <Route path="/history" element={<TransactionHistoryPage />} />
                        <Route path="/duel-history" element={<DuelHistoryPage />} />
                        <Route path="/games/rivals/dashboard" element={<ProtectedRoute requireGameProfile="rivals"><RivalsDashboard /></ProtectedRoute>} />
                        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                        <Route path="/admin/system-controls" element={<AdminRoute masterOnly={true}><AdminSystemControlsPage /></AdminRoute>} />
                        <Route path="/admin/games/rivals/tournaments/create" element={<AdminRoute><RivalsTournamentCreatePage /></AdminRoute>} />
                    </Route>
                    
                    <Route path="/games/rivals/link" element={<ProtectedRoute><RivalsLinkPage /></ProtectedRoute>} />
                    
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </Suspense>
        </ErrorBoundary>
    );
};

export default App;
