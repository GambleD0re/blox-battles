// frontend/src/components/Dashboard/CreateTicketModal.jsx
import React, { useState } from 'react';
import { Modal } from './Modals';

const CreateTicketModal = ({ isOpen, onClose, onSubmit, isSubmitting }) => {
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!subject.trim() || !message.trim()) return;
        onSubmit({ subject, message });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Support Ticket">
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-gray-400">
                    A staff member will assist you in a private channel on our Discord server. Please provide as much detail as possible.
                </p>
                <div className="form-group">
                    <label htmlFor="ticket-subject">Subject</label>
                    <select id="ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required className="form-input">
                        <option value="" disabled>Select a category...</option>
                        <option value="Billing Issue">Billing Issue</option>
                        <option value="Technical Problem / Bug Report">Technical Problem / Bug Report</option>
                        <option value="Player Report">Player Report</option>
                        <option value="General Question">General Question</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="ticket-message">Message</label>
                    <textarea id="ticket-message" value={message} onChange={(e) => setMessage(e.target.value)} required className="form-input !h-32" placeholder="Describe your issue here..." />
                </div>
                <div className="modal-actions">
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit Ticket'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default CreateTicketModal;
