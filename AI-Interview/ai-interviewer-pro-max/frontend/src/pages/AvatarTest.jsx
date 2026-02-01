import React, { useState, useEffect } from 'react';
import InterviewerAvatar from '../components/InterviewerAvatar';
import '../components/InterviewerAvatar/styles.css';

/**
 * Test page for the 3D Avatar component
 * Accessible at /avatar-test route
 */
export default function AvatarTest() {
    const [speaking, setSpeaking] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0.5);
    const [theme, setTheme] = useState('dark');
    const [listening, setListening] = useState(true);
    const [logs, setLogs] = useState([{ time: new Date(), message: 'Page initialized', type: 'info' }]);

    // Listen to console logs from the avatar
    useEffect(() => {
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;

        const addLog = (message, type) => {
            setLogs(prev => [{ time: new Date(), message, type }, ...prev.slice(0, 49)]);
        };

        console.log = (...args) => {
            originalLog(...args);
            const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
            if (msg.includes('[Avatar]') || msg.includes('[GLBAvatar]') || msg.includes('[EyeContact]') || msg.includes('[useFrame]')) {
                addLog(msg, 'info');
            }
        };

        console.warn = (...args) => {
            originalWarn(...args);
            addLog(args.join(' '), 'warn');
        };

        console.error = (...args) => {
            originalError(...args);
            addLog(args.join(' '), 'error');
        };

        addLog('Console logging attached', 'info');

        return () => {
            console.log = originalLog;
            console.warn = originalWarn;
            console.error = originalError;
        };
    }, []);

    useEffect(() => {
        document.body.style.background = theme === 'dark' ? '#0d0d1a' : '#f0f4f8';
        document.body.style.color = theme === 'dark' ? 'white' : '#1a1a2e';
    }, [theme]);

    const toggleSpeaking = () => {
        setSpeaking(!speaking);
        setListening(speaking); // When speaking stops, start listening
    };

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    const containerStyle = {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif"
    };

    const controlsStyle = {
        padding: '16px',
        background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
        alignItems: 'center',
        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
    };

    const controlGroupStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
    };

    const labelStyle = {
        fontSize: '12px',
        color: theme === 'dark' ? '#888' : '#666'
    };

    const buttonStyle = (variant) => ({
        padding: '8px 16px',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: '600',
        transition: 'all 0.2s',
        background: variant === 'speaking' ? '#22c55e' : variant === 'silent' ? '#3b82f6' : '#8b5cf6',
        color: 'white'
    });

    const avatarWrapperStyle = {
        flex: 1,
        position: 'relative',
        minHeight: '400px'
    };

    const logsStyle = {
        padding: '16px',
        background: theme === 'dark' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.05)',
        maxHeight: '200px',
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: '12px'
    };

    const getLogColor = (type) => {
        if (type === 'error') return '#f87171';
        if (type === 'warn') return '#fbbf24';
        return theme === 'dark' ? '#60a5fa' : '#2563eb';
    };

    return (
        <div style={containerStyle}>
            <div style={controlsStyle}>
                <h2 style={{ margin: 0, fontSize: '18px' }}>🎭 Avatar Test Page</h2>

                <div style={controlGroupStyle}>
                    <label style={labelStyle}>Speaking State</label>
                    <button
                        onClick={toggleSpeaking}
                        style={buttonStyle(speaking ? 'speaking' : 'silent')}
                    >
                        {speaking ? '🔊 Stop Speaking' : '🔇 Start Speaking'}
                    </button>
                </div>

                <div style={controlGroupStyle}>
                    <label style={labelStyle}>Audio Level: {audioLevel.toFixed(2)}</label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={audioLevel}
                        onChange={(e) => setAudioLevel(parseFloat(e.target.value))}
                        style={{ width: '150px' }}
                    />
                </div>

                <div style={controlGroupStyle}>
                    <label style={labelStyle}>Theme</label>
                    <button
                        onClick={toggleTheme}
                        style={buttonStyle('theme')}
                    >
                        {theme === 'dark' ? '☀️ Switch to Light' : '🌙 Switch to Dark'}
                    </button>
                </div>

                <div style={controlGroupStyle}>
                    <label style={labelStyle}>Listening</label>
                    <button
                        onClick={() => setListening(!listening)}
                        style={{ ...buttonStyle('silent'), background: listening ? '#22c55e' : '#6b7280' }}
                    >
                        {listening ? '👂 Listening' : '🔇 Not Listening'}
                    </button>
                </div>
            </div>

            <div style={avatarWrapperStyle}>
                <InterviewerAvatar
                    speaking={speaking}
                    audioLevel={audioLevel}
                    enabled={true}
                    theme={theme}
                    listening={listening}
                    enableWebcam={true}
                />
            </div>

            <div style={logsStyle}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px', color: theme === 'dark' ? '#fff' : '#000' }}>
                    📋 Console Logs
                </div>
                {logs.map((log, i) => (
                    <div key={i} style={{
                        padding: '2px 0',
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                        color: getLogColor(log.type)
                    }}>
                        [{log.time.toLocaleTimeString()}] {log.message}
                    </div>
                ))}
            </div>
        </div>
    );
}
