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
        <defs>
          <linearGradient id="pinslimGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00E5FF" />
            <stop offset="1" stopColor="#0077FF" />
          </linearGradient>
          <linearGradient id="pinslimChip" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1E293B" />
            <stop offset="1" stopColor="#0F172A" />
          </linearGradient>
        </defs>

        {/* Outer pins */}
        <path d="M10 2V6M16 2V6M22 2V6" stroke="url(#pinslimGrad)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 26V30M16 26V30M22 26V30" stroke="url(#pinslimGrad)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M2 10H6M2 16H6M2 22H6" stroke="url(#pinslimGrad)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M26 10H30M26 16H30M26 22H30" stroke="url(#pinslimGrad)" strokeWidth="1.5" strokeLinecap="round" />

        {/* Chip Body */}
        <rect x="5" y="5" width="22" height="22" rx="4" fill="url(#pinslimChip)" stroke="url(#pinslimGrad)" strokeWidth="1.5" />

        {/* Inner Trace / Pin Pattern */}
        <rect x="10" y="10" width="12" height="12" rx="2" fill="#00E5FF" fillOpacity="0.15" stroke="#00E5FF" strokeWidth="1" strokeDasharray="3 1" />
        
        {/* Center Node */}
        <circle cx="16" cy="16" r="2.5" fill="#00E5FF" />
      </svg>
      {showText && (
        <span
          style={{
            fontWeight: 700,
            fontSize: `${Math.max(14, size * 0.75)}px`,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #FFFFFF 30%, #00E5FF 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Pinslim
        </span>
      )}
    </div>
  );
};
