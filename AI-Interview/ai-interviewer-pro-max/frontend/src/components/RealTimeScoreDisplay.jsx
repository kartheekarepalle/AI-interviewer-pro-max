/**
 * Real-time Score Display
 * 
 * Shows live interview performance scores.
 * Updates as the user answers questions.
 */

import React, { useMemo } from 'react';
import {
    Brain,
    MessageCircle,
    Code2,
    Eye,
    TrendingUp,
    TrendingDown,
    Minus,
} from 'lucide-react';
import { getScoreGrade } from '../services/scoringService';

function ScoreCard({ icon: Icon, label, score, previousScore = null }) {
    const { grade, label: gradeLabel, color } = getScoreGrade(score);

    const trend = useMemo(() => {
        if (previousScore === null) return 'neutral';
        if (score > previousScore + 2) return 'up';
        if (score < previousScore - 2) return 'down';
        return 'neutral';
    }, [score, previousScore]);

    return (
        <div className="score-card">
            <div className="score-header">
                <Icon size={16} className="score-icon" />
                <span className="score-label">{label}</span>
                {trend === 'up' && <TrendingUp size={14} className="trend-up" />}
                {trend === 'down' && <TrendingDown size={14} className="trend-down" />}
                {trend === 'neutral' && previousScore !== null && <Minus size={14} className="trend-neutral" />}
            </div>
            <div className="score-value">
                <span className="score-number" style={{ color }}>{score}</span>
                <span className="score-grade" style={{ backgroundColor: `${color}20`, color }}>{grade}</span>
            </div>
            <div className="score-bar">
                <div
                    className="score-bar-fill"
                    style={{ width: `${score}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
}

function RealTimeScoreDisplay({ scores = {}, previousScores = null, compact = false }) {
    const {
        clarity = 50,
        confidence = 50,
        technical = 50,
        eyeContact = 50,
        overall = 50,
    } = scores;

    const prev = previousScores || {};
    const { grade, label, color } = getScoreGrade(overall);

    if (compact) {
        return (
            <div className="score-display compact">
                <div className="overall-compact">
                    <span className="overall-label">Score</span>
                    <span className="overall-value" style={{ color }}>{overall}</span>
                    <span className="overall-grade" style={{ backgroundColor: `${color}20`, color }}>{grade}</span>
                </div>

                <style jsx>{`
          .score-display.compact {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-2) var(--space-3);
            background: var(--bg-tertiary);
            border-radius: var(--radius-lg);
          }
          
          .overall-compact {
            display: flex;
            align-items: center;
            gap: var(--space-2);
          }
          
          .overall-label {
            font-size: var(--text-xs);
            color: var(--text-muted);
          }
          
          .overall-value {
            font-weight: var(--font-bold);
            font-size: var(--text-lg);
          }
          
          .overall-grade {
            padding: 2px 6px;
            font-size: var(--text-xs);
            font-weight: var(--font-semibold);
            border-radius: var(--radius-sm);
          }
        `}</style>
            </div>
        );
    }

    return (
        <div className="score-display">
            <div className="overall-score">
                <div className="overall-value" style={{ color }}>{overall}</div>
                <div className="overall-grade" style={{ backgroundColor: `${color}20`, color }}>{label}</div>
                <div className="overall-label">Overall Score</div>
            </div>

            <div className="score-breakdown">
                <ScoreCard
                    icon={MessageCircle}
                    label="Clarity"
                    score={clarity}
                    previousScore={prev.clarity}
                />
                <ScoreCard
                    icon={Brain}
                    label="Confidence"
                    score={confidence}
                    previousScore={prev.confidence}
                />
                <ScoreCard
                    icon={Code2}
                    label="Technical"
                    score={technical}
                    previousScore={prev.technical}
                />
                <ScoreCard
                    icon={Eye}
                    label="Eye Contact"
                    score={eyeContact}
                    previousScore={prev.eyeContact}
                />
            </div>

            <style jsx>{`
        .score-display {
          padding: var(--space-4);
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
        }
        
        .overall-score {
          text-align: center;
          padding-bottom: var(--space-4);
          margin-bottom: var(--space-4);
          border-bottom: 1px solid var(--border-color);
        }
        
        .overall-value {
          font-family: var(--font-display);
          font-size: 3rem;
          font-weight: var(--font-extrabold);
          line-height: 1;
        }
        
        .overall-grade {
          display: inline-block;
          margin-top: var(--space-2);
          padding: var(--space-1) var(--space-3);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          border-radius: var(--radius-full);
        }
        
        .overall-label {
          margin-top: var(--space-2);
          font-size: var(--text-sm);
          color: var(--text-muted);
        }
        
        .score-breakdown {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-3);
        }
        
        @media (max-width: 600px) {
          .score-breakdown {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

            <style jsx global>{`
        .score-card {
          padding: var(--space-3);
          background: var(--bg-tertiary);
          border-radius: var(--radius-lg);
        }
        
        .score-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-2);
        }
        
        .score-icon {
          color: var(--text-muted);
        }
        
        .score-label {
          flex: 1;
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .trend-up {
          color: #10b981;
        }
        
        .trend-down {
          color: #ef4444;
        }
        
        .trend-neutral {
          color: var(--text-muted);
        }
        
        .score-value {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-2);
        }
        
        .score-number {
          font-size: var(--text-xl);
          font-weight: var(--font-bold);
        }
        
        .score-grade {
          padding: 2px 6px;
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          border-radius: var(--radius-sm);
        }
        
        .score-bar {
          height: 4px;
          background: var(--bg-card);
          border-radius: var(--radius-full);
          overflow: hidden;
        }
        
        .score-bar-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 0.5s ease-out;
        }
      `}</style>
        </div>
    );
}

export default RealTimeScoreDisplay;
