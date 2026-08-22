import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ExampleProject } from '../../data/examples';
import { loadExample } from '../../utils/loadExample';
import { ExamplesGallery } from '../examples/ExamplesGallery';

interface ExamplesModalProps {
  onClose: () => void;
}

export const ExamplesModal: React.FC<ExamplesModalProps> = ({ onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleLoadExample = async (ex: ExampleProject) => {
    try {
      await loadExample(ex);
      onClose();
    } catch (err) {
      console.error('Failed to load example:', err);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(1180px, 94vw)',
          height: '86vh',
          maxHeight: '900px',
          backgroundColor: '#1e1e1e',
          color: '#f0f4f8',
          border: '1px solid #3d3d3d',
          borderRadius: '14px',
          padding: '24px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar with close button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>📂</span>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#f0f4f8' }}>
              Pinslim Beispiel-Projekte
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a0aec0',
              fontSize: '26px',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '4px 8px',
            }}
          >
            &times;
          </button>
        </div>

        {/* Scrollable Gallery containing all Velxio sorting, filtering and cards */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          <ExamplesGallery onLoadExample={handleLoadExample} />
        </div>
      </div>
    </div>,
    document.body,
  );
};
