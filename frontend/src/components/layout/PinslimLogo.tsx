import React from 'react';

interface PinslimLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export const PinslimLogo: React.FC<PinslimLogoProps> = ({
  size = 24,
  showText = true,
  className = '',
}) => {
  return (
    <div
      className={`pinslim-logo-container ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', userSelect: 'none' }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >

        {/* Outer pins */}
        <path d="M10 2V6M16 2V6M22 2V6" stroke="#E8836B" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 26V30M16 26V30M22 26V30" stroke="#E8836B" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M2 10H6M2 16H6M2 22H6" stroke="#E8836B" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M26 10H30M26 16H30M26 22H30" stroke="#E8836B" strokeWidth="1.5" strokeLinecap="round" />

        {/* Chip Body */}
        <rect x="5" y="5" width="22" height="22" rx="4" fill="url(#pinslimChip)" stroke="#E8836B" strokeWidth="1.5" />

        {/* Inner Trace / Pin Pattern */}
        <rect x="10" y="10" width="12" height="12" rx="2" fill="#F6B48F" fillOpacity="0.2" stroke="#F6B48F" strokeWidth="1" strokeDasharray="3 1" />
        
        {/* Center Node */}
        <circle cx="16" cy="16" r="2.5" fill="#F6B48F" />
      </svg>
      {showText && (
        <span
          style={{
            fontWeight: 700,
            fontSize: `${Math.max(14, size * 0.75)}px`,
            letterSpacing: '-0.02em',
            fontFamily: 'var(--font-heading)',
            color: 'var(--color-fg-default)',
          }}
        >
          Pinslim<span style={{ color: 'var(--pinslim-logo-accent)' }}>.</span>
        </span>
      )}
    </div>
  );
};
