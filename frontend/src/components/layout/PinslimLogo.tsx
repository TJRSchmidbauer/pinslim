import React from 'react';

interface PinslimLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  variant?: 'default' | 'icon-only' | 'text-only';
}

export const PinslimLogo: React.FC<PinslimLogoProps> = ({
  size = 24,
  showText = true,
  className = '',
  variant = 'default',
}) => {
  const pinCount = 7;
  const pinRadius = size * 0.085;
  const pinGap = size * 0.06;
  const trackHeight = size * 0.12;
  const trackWidth = pinCount * (pinRadius * 2 + pinGap) - pinGap;
  const trackY = size / 2;
  const startX = (size - trackWidth) / 2;

  return (
    <div
      className={`pinslim-logo-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: showText && variant !== 'icon-only' ? '8px' : 0,
        userSelect: 'none',
        flexDirection: variant === 'text-only' ? 'column' : 'row',
      }}
    >
      {variant !== 'text-only' && (
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0 }}
          role="img"
          aria-label="Pinslim"
        >
          <defs>
            {/* Main brand gradient: Cyan → Blue */}
            <linearGradient id="pinslimPinGrad" x1="0" y1="0" x2={size} y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#00E5FF" offset="0%" />
              <stop stopColor="#0077FF" offset="100%" />
            </linearGradient>
            {/* Track gradient */}
            <linearGradient id="pinslimTrackGrad" x1="0" y1="0" x2={size} y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#00E5FF" offset="0%" stopOpacity="0.25" />
              <stop stopColor="#0077FF" offset="50%" stopOpacity="0.4" />
              <stop stopColor="#00E5FF" offset="100%" stopOpacity="0.25" />
            </linearGradient>
            {/* Glow filter for pins */}
            <filter id="pinGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Connecting track - the "slim" bridge between pins */}
          <rect
            x={startX}
            y={trackY - trackHeight / 2}
            width={trackWidth}
            height={trackHeight}
            rx={trackHeight / 2}
            fill="url(#pinslimTrackGrad)"
            stroke="url(#pinslimPinGrad)"
            strokeWidth={Math.max(1, size * 0.025)}
          />

          {/* Pin circles - the "pins" in Pinslim */}
          {Array.from({ length: pinCount }, (_, i) => {
            const cx = startX + i * (pinRadius * 2 + pinGap) + pinRadius;
            // Subtle stagger for visual rhythm
            const cy = trackY + (i % 2 === 0 ? -size * 0.015 : size * 0.015);
            return (
              <g key={i} filter="url(#pinGlow)">
                {/* Pin base */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={pinRadius * 1.15}
                  fill="#0F172A"
                  stroke="url(#pinslimPinGrad)"
                  strokeWidth={Math.max(1, size * 0.02)}
                />
                {/* Pin highlight - the conductive tip */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={pinRadius * 0.65}
                  fill="url(#pinslimPinGrad)"
                />
                {/* Inner specular */}
                <circle
                  cx={cx - pinRadius * 0.2}
                  cy={cy - pinRadius * 0.2}
                  r={pinRadius * 0.25}
                  fill="#FFFFFF"
                  fillOpacity="0.6"
                />
              </g>
            );
          })}

          {/* Subtle signal wave hint - 3 small dots suggesting data flow */}
          {size >= 28 && Array.from({ length: 3 }, (_, i) => (
            <circle
              key={i}
              cx={startX + trackWidth * (0.25 + i * 0.25)}
              cy={trackY + trackHeight * 1.8}
              r={Math.max(1.2, size * 0.035)}
              fill="url(#pinslimPinGrad)"
              fillOpacity={0.5 - i * 0.1}
              className="pinslim-pulse-dot"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </svg>
      )}

      {showText && variant !== 'icon-only' && (
        <span
          style={{
            fontWeight: 700,
            fontSize: `${Math.max(13, size * 0.7)}px`,
            letterSpacing: '-0.015em',
            lineHeight: 1,
            fontFamily: '"Inter var", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            background: 'linear-gradient(135deg, #111827 20%, #00E5FF 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            color: '#111827', /* fallback */
          }}
        >
          Pinslim
        </span>
      )}
    </div>
  );
};

// Convenience exports for common use cases
export const PinslimIcon = (props: Omit<PinslimLogoProps, 'showText' | 'variant'>) =>
  <PinslimLogo {...props} variant="icon-only" showText={false} />;

export const PinslimWordmark = (props: Omit<PinslimLogoProps, 'showText' | 'variant'>) =>
  <PinslimLogo {...props} variant="text-only" showText={true} size={props.size ?? 28} />;