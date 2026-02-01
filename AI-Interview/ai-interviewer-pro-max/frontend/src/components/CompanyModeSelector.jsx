/**
 * Company Mode Selector
 * 
 * Allows users to select interview mode based on company type.
 * Affects question style, scoring thresholds, and interviewer personality.
 */

import React, { useState } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { COMPANY_MODES, getCompanyModeList } from '../services/scoringService';

function CompanyModeSelector({ value = 'faang', onChange, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const modes = getCompanyModeList();
  const selectedMode = COMPANY_MODES[value] || COMPANY_MODES.faang;

  const handleSelect = (modeId) => {
    onChange?.(modeId);
    setIsOpen(false);
  };

  return (
    <div className="company-mode-selector">
      <label className="selector-label">
        <Building2 size={16} />
        Interview Mode
      </label>

      <div className="selector-container">
        <button
          type="button"
          className={`selector-trigger ${isOpen ? 'open' : ''}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
        >
          <span className="mode-icon">{selectedMode.icon}</span>
          <div className="mode-info">
            <span className="mode-name">{selectedMode.name}</span>
            <span className="mode-desc">{selectedMode.description}</span>
          </div>
          <ChevronDown size={18} className={`chevron ${isOpen ? 'rotated' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div className="selector-backdrop" onClick={() => setIsOpen(false)} />
            <div className="selector-dropdown">
              {modes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={`dropdown-option ${mode.id === value ? 'selected' : ''}`}
                  onClick={() => handleSelect(mode.id)}
                >
                  <span className="mode-icon">{mode.icon}</span>
                  <div className="mode-info">
                    <span className="mode-name">{mode.name}</span>
                    <span className="mode-desc">{mode.description}</span>
                  </div>
                  {mode.id === value && <Check size={18} className="check-icon" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .company-mode-selector {
          margin-bottom: var(--space-6);
        }
        
        .selector-label {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-2);
          font-weight: var(--font-medium);
          font-size: var(--text-sm);
          color: var(--text-secondary);
        }
        
        .selector-container {
          position: relative;
        }
        
        .selector-trigger {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          width: 100%;
          padding: var(--space-3) var(--space-4);
          background: var(--bg-card);
          border: 2px solid var(--border-color);
          border-radius: var(--radius-xl);
          text-align: left;
          transition: all var(--transition-fast);
        }
        
        .selector-trigger:hover:not(:disabled) {
          border-color: var(--primary);
        }
        
        .selector-trigger.open {
          border-color: var(--primary);
          box-shadow: 0 0 0 4px var(--primary-glow);
        }
        
        .selector-trigger:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .mode-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }
        
        .mode-info {
          flex: 1;
          min-width: 0;
        }
        
        .mode-name {
          display: block;
          font-weight: var(--font-semibold);
          font-size: var(--text-base);
          color: var(--text-primary);
        }
        
        .mode-desc {
          display: block;
          font-size: var(--text-xs);
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .chevron {
          color: var(--text-muted);
          flex-shrink: 0;
          transition: transform var(--transition-fast);
        }
        
        .chevron.rotated {
          transform: rotate(180deg);
        }
        
        .selector-backdrop {
          position: fixed;
          inset: 0;
          z-index: 10;
        }
        
        .selector-dropdown {
          position: absolute;
          top: calc(100% + var(--space-2));
          left: 0;
          right: 0;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-xl);
          z-index: 11;
          overflow: hidden;
          animation: slideDown 0.2s ease-out;
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .dropdown-option {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          width: 100%;
          padding: var(--space-3) var(--space-4);
          text-align: left;
          transition: all var(--transition-fast);
        }
        
        .dropdown-option:hover {
          background: var(--bg-tertiary);
        }
        
        .dropdown-option.selected {
          background: var(--primary-glow);
        }
        
        .dropdown-option.selected .mode-name {
          color: var(--primary);
        }
        
        .check-icon {
          color: var(--primary);
          flex-shrink: 0;
        }
        
        .dropdown-option + .dropdown-option {
          border-top: 1px solid var(--border-color);
        }
      `}</style>
    </div>
  );
}

export default CompanyModeSelector;
