// frontend/src/pages/TermsOfServicePage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const Section = ({ title, children }) => (
    <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-3 border-b-2 border-gray-700 pb-2">{title}</h2>
        <div className="space-y-3 text-gray-400">{children}</div>
    </div>
);

const TermsOfServicePage = () => {
    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-8 pb-4 border-b border-gray-700">
                    <h1 className="text-4xl font-bold">Terms of Service</h1>
                    <Link to="/signup" className="btn btn-secondary !mt-0">Back to Sign Up</Link>
                </header>

                <div className="widget">
                    <p className="text-gray-500 mb-6">Last Updated: August 25, 2025</p>
                    
                    <Section title="1. Acceptance of Terms">
                        <p>By creating an account and using the Blox Battles platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to all of these Terms, do not use our Service.</p>
                    </Section>

                    <Section title="2. User Accounts">
                        <p>You must be 18 years of age or older to use this Service. You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.</p>
                    </Section>

                    <Section title="3. Prohibited Conduct">
                        <p>You agree not to engage in any of the following prohibited activities: cheating, exploiting bugs, using unauthorized third-party software, harassing other users, or engaging in any unlawful activity. Violation may result in an immediate account ban and forfeiture of all funds.</p>
                    </Section>

                    <Section title="4. Deposits, Wagers, and Withdrawals">
                        <p>All transactions are conducted using "Gems," the virtual currency of the platform. Gems have no real-world value outside of the Service. All deposits are final and non-refundable. We charge a service fee (tax) on the pot of each duel, which is clearly stated before the match begins. Withdrawals are subject to review and may be delayed or denied if fraudulent activity is suspected.</p>
                    </Section>

                    <Section title="5. Disclaimers and Limitation of Liability">
                        <p>The Service is provided "as is" without any warranties. Blox Battles is not responsible for any losses incurred due to server instability, game bugs, or other technical issues. Our liability is limited to the maximum extent permitted by law.</p>
                    </Section>

                    <Section title="6. Changes to Terms">
                        <p>We reserve the right to modify these Terms at any time. We will notify you of any changes by posting the new Terms on this page. Your continued use of the Service after any such changes constitutes your acceptance of the new Terms.</p>
                    </Section>
                </div>
            </div>
        </div>
    );
};

export default TermsOfServicePage;
