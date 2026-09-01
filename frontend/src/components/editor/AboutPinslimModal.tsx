import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PinslimLogo } from '../layout/PinslimLogo';

interface AboutPinslimModalProps {
  onClose: () => void;
}

export const AboutPinslimModal: React.FC<AboutPinslimModalProps> = ({ onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--color-bg-overlay)',
        backdropFilter: 'blur(6px)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(620px, 92vw)',
          maxHeight: '82vh',
          backgroundColor: 'var(--wb-2)',
          color: 'var(--wb-13)',
          border: '1px solid var(--wb-7)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: 'var(--shadow-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <PinslimLogo size={28} showText={true} />
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--wb-11)',
              fontSize: '24px',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '4px 8px',
            }}
          >
            &times;
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--wb-12)', overflowY: 'auto', paddingRight: '4px' }}>
          <p style={{ marginTop: 0, marginBottom: '14px' }}>
            <strong>Pinslim</strong> ist ein moderner, browserbasierter Open-Source-Mikrocontroller- und Schaltplansimulator für ESP32, Arduino und elektronische Schaltungen.
          </p>

          {/* Herkunft / Origin */}
          <div
            style={{
              backgroundColor: 'var(--color-accent-soft)',
              borderLeft: '4px solid var(--color-action-primary)',
              padding: '12px 14px',
              borderRadius: '4px',
              marginBottom: '14px',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--color-accent-fg)', marginBottom: '4px' }}>
              📌 Herkunft & Basisprojekt:
            </div>
            Pinslim basiert als eigener Fork auf dem Open-Source-Projekt <strong>Velxio</strong> von <em>David Montero Crespo</em>.
            <div style={{ marginTop: '6px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <a
                href="https://github.com/davidmonterocrespo24/velxio"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--color-accent-fg)', textDecoration: 'underline' }}
              >
                Original Velxio Repository (GitHub) &rarr;
              </a>
            </div>
          </div>

          {/* Antigravity AI Assistant Notice */}
          <div
            style={{
              backgroundColor: 'rgba(168, 85, 247, 0.1)',
              borderLeft: '4px solid #a855f7',
              padding: '12px 14px',
              borderRadius: '4px',
              marginBottom: '14px',
            }}
          >
            <div style={{ fontWeight: 600, color: '#a855f7', marginBottom: '4px' }}>
              🤖 KI-gestützte Entwicklung mit Antigravity:
            </div>
            Sämtliche Modifikationen, Erweiterungen, Refactorings und Fehlerbehebungen an diesem Projekt wurden in kooperativer Entwicklung unter Einsatz des KI-Assistenten <strong>Antigravity</strong> (Google DeepMind) durchgeführt.
          </div>

          {/* Markenhinweis / Trademark Disclaimer */}
          <div
            style={{
              backgroundColor: 'var(--wb-3)',
              border: '1px solid var(--color-border-default)',
              padding: '12px 14px',
              borderRadius: '6px',
              marginBottom: '14px',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--wb-13)', marginBottom: '4px' }}>
              ⚖️ Markenhinweis & Rechteinhaber:
            </div>
            Alle genannten Markennamen, Warenzeichen, Logos und Produktbezeichnungen (wie z. B. <em>Arduino, ESP32, Espressif, Raspberry Pi, MicroPython, SAMD, RP2040</em>) sind Eigentum der jeweiligen Rechteinhaber. Pinslim ist ein unabhängiges Open-Source-Projekt und steht in keinerlei Verbindung, Sponsoring oder geschäftlichen Beziehung zu diesen Rechteinhabern.
          </div>

          {/* Partner & Sponsoren Hinweis */}
          <div
            style={{
              backgroundColor: 'var(--wb-3)',
              border: '1px solid var(--color-border-default)',
              padding: '12px 14px',
              borderRadius: '6px',
              marginBottom: '14px',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--wb-13)', marginBottom: '4px' }}>
              🤝 Hinweis zu Partnern & Sponsoren:
            </div>
            Sämtliche im ursprünglichen Velxio-Projekt genannten Partner, Sponsoren oder Werbepartner gehören ausschließlich zum Projekt von David Montero Crespo / Velxio und sind <strong>keine Partner oder Sponsoren von Pinslim</strong>.
          </div>

          {/* Lizenz & Haftungsausschluss */}
          <div
            style={{
              backgroundColor: 'var(--wb-3)',
              border: '1px solid var(--color-border-default)',
              padding: '12px 14px',
              borderRadius: '6px',
              marginBottom: '14px',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--wb-13)', marginBottom: '4px' }}>
              📄 Lizenz & Haftungsausschluss:
            </div>
            Pinslim wird unter den Bedingungen der <strong>GNU Affero General Public License v3.0 (AGPLv3)</strong> bereitgestellt. Die Software wird &quot;WIE SIE IST&quot; (AS IS) ohne jegliche ausdrückliche oder stillschweigende Gewährleistung oder Haftung zur Verfügung gestellt.
          </div>

          {/* Features */}
          <h4 style={{ color: 'var(--wb-13)', marginBottom: '8px', marginTop: '16px', fontSize: '13px' }}>
            Erweiterungen in Pinslim:
          </h4>
          <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <li>Eigenes Pinslim Branding & Vector-Logo</li>
            <li>Direkter Editor-Start (ohne Marketing-Landingsseite)</li>
            <li>Heller Modus (Light Theme) im Ansicht-Menü</li>
            <li>Browser-Flashing via Web Serial (ESP32 & Arduino)</li>
            <li>Integrierte Beispiel-Projekte per Direkt-Modal</li>
            <li>Open-Source Docker Setup ohne proprietäre Registrierung</li>
          </ul>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 22px',
              backgroundColor: 'var(--color-action-primary)',
              color: 'var(--color-action-primary-fg)',
              fontWeight: 600,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Schließen
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
