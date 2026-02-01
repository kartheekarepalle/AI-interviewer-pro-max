/**
 * Domain Selection Page - Choose Interview Domain
 * 
 * This page appears between Dashboard and Interview Prep.
 * Users select their domain (Computer Science, ECE, EEE, etc.)
 * before proceeding to interview preparation.
 * 
 * PRODUCTION-GRADE: Premium design with animations
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getStoredUser } from '../services/api';
import {
    Code2, Cpu, Zap, Building2, Palette, Stethoscope, Scale, Briefcase,
    ChevronRight, ArrowLeft, Sparkles, GraduationCap, Rocket, Lock
} from 'lucide-react';
import './DomainSelection.css';

// Domain definitions - expandable for future
const DOMAINS = [
    {
        id: 'computer_science',
        name: 'Computer Science',
        shortName: 'CSE',
        icon: Code2,
        description: 'Software Engineering, Data Structures, Algorithms, System Design',
        color: '#8b5cf6',
        gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
        available: true,
        topics: ['DSA', 'System Design', 'OOP', 'DBMS', 'OS', 'Networking'],
    },
    {
        id: 'electronics',
        name: 'Electronics & Communication',
        shortName: 'ECE',
        icon: Cpu,
        description: 'Digital Electronics, Signal Processing, VLSI, Communication Systems',
        color: '#06b6d4',
        gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
        available: false, // Coming soon
        topics: ['Digital Electronics', 'Analog Circuits', 'Signals', 'VLSI'],
    },
    {
        id: 'electrical',
        name: 'Electrical Engineering',
        shortName: 'EEE',
        icon: Zap,
        description: 'Power Systems, Control Systems, Electrical Machines, Power Electronics',
        color: '#f59e0b',
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        available: false,
        topics: ['Power Systems', 'Control Systems', 'Machines', 'Electronics'],
    },
    {
        id: 'civil',
        name: 'Civil Engineering',
        shortName: 'CE',
        icon: Building2,
        description: 'Structural, Geotechnical, Transportation, Environmental Engineering',
        color: '#10b981',
        gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        available: false,
        topics: ['Structures', 'Geotechnical', 'Surveying', 'Construction'],
    },
    {
        id: 'mechanical',
        name: 'Mechanical Engineering',
        shortName: 'ME',
        icon: Briefcase,
        description: 'Thermodynamics, Mechanics, Manufacturing, Design Engineering',
        color: '#ef4444',
        gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        available: false,
        topics: ['Thermodynamics', 'Fluid Mechanics', 'Manufacturing', 'Design'],
    },
    {
        id: 'architecture',
        name: 'Architecture',
        shortName: 'ARCH',
        icon: Palette,
        description: 'Design, Urban Planning, Building Technology, Sustainability',
        color: '#ec4899',
        gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
        available: false,
        topics: ['Design', 'Planning', 'Technology', 'Theory'],
    },
];

function DomainSelection() {
    const navigate = useNavigate();
    const user = getStoredUser();
    const [selectedDomain, setSelectedDomain] = useState(null);
    const [isAnimating, setIsAnimating] = useState(false);

    const handleSelectDomain = (domain) => {
        if (!domain.available) return;

        setSelectedDomain(domain.id);
        setIsAnimating(true);

        // Navigate after animation
        setTimeout(() => {
            navigate('/interview-prep', {
                state: {
                    domain: domain.id,
                    domainName: domain.name,
                    domainTopics: domain.topics,
                }
            });
        }, 400);
    };

    const handleBack = () => {
        navigate('/dashboard');
    };

    return (
        <div className="domain-selection-container">
            <Navbar user={user} />

            <main className="domain-selection-main">
                {/* Back Button */}
                <button className="back-button" onClick={handleBack}>
                    <ArrowLeft size={20} />
                    <span>Back to Dashboard</span>
                </button>

                {/* Header Section */}
                <section className="domain-header">
                    <div className="header-badge">
                        <GraduationCap size={18} />
                        <span>Interview Domain</span>
                    </div>
                    <h1>
                        Choose Your Field
                        <Sparkles size={32} className="header-sparkle" />
                    </h1>
                    <p className="header-subtitle">
                        Select your domain to get tailored interview questions based on your expertise
                    </p>
                </section>

                {/* Domain Grid */}
                <section className="domain-grid">
                    {DOMAINS.map((domain) => {
                        const IconComponent = domain.icon;
                        const isSelected = selectedDomain === domain.id;
                        const isLocked = !domain.available;

                        return (
                            <button
                                key={domain.id}
                                className={`domain-card ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''} ${isAnimating && isSelected ? 'animating' : ''}`}
                                onClick={() => handleSelectDomain(domain)}
                                disabled={isLocked}
                                style={{
                                    '--domain-color': domain.color,
                                    '--domain-gradient': domain.gradient,
                                }}
                            >
                                {/* Glow Effect */}
                                <div className="card-glow" />

                                {/* Lock Badge for Coming Soon */}
                                {isLocked && (
                                    <div className="coming-soon-badge">
                                        <Lock size={12} />
                                        <span>Coming Soon</span>
                                    </div>
                                )}

                                {/* Icon Circle */}
                                <div className="domain-icon-wrapper">
                                    <div className="domain-icon-bg" />
                                    <IconComponent size={36} className="domain-icon" />
                                </div>

                                {/* Content */}
                                <div className="domain-content">
                                    <div className="domain-name-row">
                                        <h3 className="domain-name">{domain.name}</h3>
                                        <span className="domain-short">{domain.shortName}</span>
                                    </div>
                                    <p className="domain-description">{domain.description}</p>

                                    {/* Topics Tags */}
                                    <div className="domain-topics">
                                        {domain.topics.slice(0, 3).map((topic) => (
                                            <span key={topic} className="topic-tag">{topic}</span>
                                        ))}
                                        {domain.topics.length > 3 && (
                                            <span className="topic-more">+{domain.topics.length - 3}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Action Indicator */}
                                {!isLocked && (
                                    <div className="domain-action">
                                        <span>Select</span>
                                        <ChevronRight size={18} />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </section>

                {/* Footer Note */}
                <section className="domain-footer">
                    <div className="footer-note">
                        <Rocket size={18} />
                        <p>
                            More domains coming soon! We're building specialized interview experiences for every field.
                        </p>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default DomainSelection;
