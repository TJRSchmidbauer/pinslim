import React from 'react';

interface Props {
  style?: React.CSSProperties;
  title?: string;
}

export const VelxioDevExklusivBadge: React.FC<Props> = ({
  style,
  title = 'velxio.dev exklusiv',
}) => (
  <span
    title={title}
    style={{
      position: 'absolute',
      top: 6,
      right: 6,
      zIndex: 10,
      padding: '3px 8px',
      borderRadius: '6px',
      fontSize: '10px',
      fontWeight: 800,
      letterSpacing: '0.4px',
      color: '#ffffff',
      background: 'linear-gradient(135deg, #ff0055 0%, #ff5500 100%)',
      boxShadow: '0 2px 8px rgba(255, 0, 85, 0.6), 0 0 6px rgba(255, 85, 0, 0.5)',
      border: '1px solid rgba(255, 255, 255, 0.4)',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      lineHeight: '1.2',
      ...style,
    }}
  >
    velxio.dev exklusiv
  </span>
);
