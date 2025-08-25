// frontend/src/pages/TranscriptViewerPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as api from '../services/api'; // Use the API service

const Loader = () => (
    <div className="flex items-center justify-center p-12">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
);

const TranscriptViewerPage = () => {
    const { duelId } = useParams();
    const [duel, setDuel] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchTranscript = async () => {
            try {
                const data = await api.getTranscript(duelId);
                setDuel(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTranscript();
    }, [duelId]);
    
    const renderEvent = (event, index) => {
        // Simple JSON stringify for consistent display
        return <pre key={index} className="whitespace-pre-wrap break-words text-sm p-2 bg-gray-800/50 rounded">{JSON.stringify(event, null, 2)}</pre>
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
                    <div>
                        <h1 className="text-3xl font-bold">{duel?.game_name || ''} Duel Transcript</h1>
                        <p className="text-gray-500">ID: {duelId}</p>
                    </div>
                    <Link to="/dashboard" className="btn btn-secondary !mt-0">Back to Blox Battles</Link>
                </header>

                {isLoading && <Loader />}
                {error && <div className="p-4 text-center bg-red-900/50 text-red-300 rounded-lg">{error}</div>}
                {duel && (
                    <div className="widget">
                        <div className="p-4 bg-black rounded-lg font-mono max-h-[60vh] overflow-y-auto space-y-2">
                            {duel.transcript && duel.transcript.length > 0 ? (
                                duel.transcript.map(renderEvent)
                            ) : (
                                <p className="text-gray-500">No events recorded in this transcript.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TranscriptViewerPage;
