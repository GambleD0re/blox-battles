// frontend/src/pages/SignUpPage.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';

const GOOGLE_AUTH_URL = `${import.meta.env.VITE_API_BASE_URL}/api/auth/google`;

const GoogleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" preserveAspectRatio="xMidYMid" viewBox="0 0 256 262"><path fill="#4285F4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.686H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027z"/><path fill="#34A853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.02 12.54-45.257 12.54-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.37.968c20.334 40.022 62.025 67.07 111.42 67.07z"/><path fill="#FBBC05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.07-.99l-41.21-31.913-.94.08c-8.518 16.827-13.08 35.406-13.08 55.628s4.562 38.799 13.08 55.627l42.201-32.79z"/><path fill="#EB4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C81.15 0 39.46 27.048 19.126 67.07l42.201 32.79c10.445-31.477 39.746-54.25 74.269-54.25z"/></svg>;

const SignUpPage = () => {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        setIsLoading(true);
        try {
            await api.registerUser({ username, email, password });
            navigate('/verification-notice', { state: { email } });
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-8 bg-[var(--widget-bg)] rounded-xl shadow-lg border border-[var(--widget-border)] text-center">
                <h1 className="text-4xl font-black text-white">Create Account</h1>
                <p className="text-gray-400">Join the arena and start dueling.</p>
                
                {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-lg">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-6 text-left">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="form-input" placeholder="Choose your Blox Battles username" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="form-input" placeholder="you@example.com" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="form-input" placeholder="••••••••" />
                        <p className="text-xs text-gray-500 mt-1">8+ characters with a number & special character.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="form-input" placeholder="••••••••" />
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition disabled:opacity-50 flex items-center justify-center">
                        {isLoading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Create Account'}
                    </button>
                </form>

                <div className="my-6 flex items-center"><div className="flex-grow border-t border-gray-600"></div><span className="flex-shrink mx-4 text-gray-400">OR</span><div className="flex-grow border-t border-gray-600"></div></div>
                <a href={GOOGLE_AUTH_URL} className="w-full flex items-center justify-center gap-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-200 font-semibold py-3 px-4 rounded-lg transition">
                    <GoogleIcon /> Sign up with Google
                </a>
                <p className="mt-8 text-sm text-gray-400">
                    Already have an account? <Link to="/signin" className="font-medium text-[var(--accent-color)] hover:underline">Sign in</Link>
                </p>
            </div>
        </div>
    );
};

export default SignUpPage;
