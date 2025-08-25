// frontend/src/pages/PrivacyPolicyPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const Section = ({ title, children }) => (
    <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-3 border-b-2 border-gray-700 pb-2">{title}</h2>
        <div className="space-y-3 text-gray-400">{children}</div>
    </div>
);

const PrivacyPolicyPage = () => {
    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-8 pb-4 border-b border-gray-700">
                    <h1 className="text-4xl font-bold">Privacy Policy</h1>
                    <Link to="/signup" className="btn btn-secondary !mt-0">Back to Sign Up</Link>
                </header>

                <div className="widget">
                    <p className="text-gray-500 mb-6">Last Updated: August 25, 2025</p>

                    <Section title="1. Information We Collect">
                        <p>We collect information you provide directly to us, such as when you create an account, make a deposit, or contact customer support. This includes your username, email address, and any other information you choose to provide.</p>
                        <p>We also collect information automatically when you use our Service, including your IP address, device information, and gameplay data.</p>
                    </Section>

                    <Section title="2. How We Use Your Information">
                        <p>We use the information we collect to operate, maintain, and improve our Service. This includes facilitating payments, resolving disputes, enforcing our terms of service, and communicating with you about your account and our services.</p>
                    </Section>

                    <Section title="3. Data Security">
                        <p>We implement reasonable security measures to protect your information from unauthorized access, use, or disclosure. However, no method of transmission over the Internet or method of electronic storage is 100% secure.</p>
                    </Section>

                    <Section title="4. Third-Party Services">
                        <p>We use third-party services for payment processing (e.g., Stripe) and authentication (e.g., Google). We do not store your full credit card information. Your interaction with these third-party services is governed by their respective privacy policies.</p>
                    </Section>

                    <Section title="5. Your Choices">
                        <p>You may update or correct your account information at any time by logging into your account settings. You may also request the deletion of your account, subject to our data retention policies and legal obligations.</p>
                    </Section>

                    <Section title="6. Changes to This Policy">
                        <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page. You are advised to review this Privacy Policy periodically for any changes.</p>
                    </Section>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicyPage;
