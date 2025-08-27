// frontend/src/components/games/rivals/QuickMatchWidget.jsx
import React from 'react';
import DisabledOverlay from '../../DisabledOverlay';

const QuickMatchWidget = ({ onJoinClick, isDisabled, disabledMessage }) => {
    return (
        <div className="widget relative">
            {isDisabled && <DisabledOverlay message={disabledMessage} />}
            <h2 className="widget-title">Quick Match</h2>
            <p className="text-gray-400 mb-4">Enter a queue to be automatically matched against another player with a similar wager.</p>
            <button onClick={onJoinClick} className="btn btn-primary w-full" disabled={isDisabled}>
                Join Random Queue
            </button>
        </div>
    );
};

export default QuickMatchWidget;
