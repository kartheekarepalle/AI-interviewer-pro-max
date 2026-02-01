/**
 * Signup Page
 * 
 * Redirects to Login page with signup mode active.
 * Login page handles both login and signup.
 * 
 * HARDENING: Shows loading state instead of null to prevent blank flash
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Signup() {
    const navigate = useNavigate();

    useEffect(() => {
        // Redirect to login with signup mode
        navigate('/login', { state: { mode: 'signup' }, replace: true });
    }, [navigate]);

    // Show loading indicator instead of null to prevent blank flash
    return (
        <div className="loading-container">
            <div className="loading-content">
                <div className="spinner"></div>
                <p className="loading-text">Redirecting to signup...</p>
            </div>
        </div>
    );
}

export default Signup;
