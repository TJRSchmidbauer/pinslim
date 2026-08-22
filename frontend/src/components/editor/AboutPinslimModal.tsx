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
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
          backgroundColor: '#1e1e1e',
          color: '#f0f4f8',
          border: '1px solid #3d3d3d',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
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
              color: '#a0aec0',
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
        <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#cbd5e0', overflowY: 'auto', paddingRight: '4px' }}>
          <p style={{ marginTop: 0, marginBottom: '14px' }}>
            <strong>Pinslim</strong> ist ein moderner, browserbasierter Open-Source-Mikrocontroller- und Schaltplansimulator für ESP32, Arduino und elektronische Schaltungen.
          </p>

          {/* Herkunft / Origin */}
          <div
            style={{
              backgroundColor: 'rgba(0, 229, 255, 0.08)',
              borderLeft: '4px solid #00E5FF',
              padding: '12px 14px',
              borderRadius: '4px',
              marginBottom: '14px',
            }}
          >
            <div style={{ fontWeight: 600, color: '#00E5FF', marginBottom: '4px' }}>
              📌 Herkunft & Basisprojekt:
            </div>
            Pinslim basiert als eigener Fork auf dem Open-Source-Projekt <strong>Velxio</strong> von <em>David Montero Crespo</em>.
            <div style={{ marginTop: '6px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <a
                href="https://github.com/davidmonterocrespo24/velxio"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#00E5FF', textDecoration: 'underline' }}
              >
                Original Velxio Repository (GitHub) &rarr;
              </a>
            </div>
          </div>

          {/* Random Nerd Tutorials Recommendation Notice */}
          <div
            style={{
              backgroundColor: 'rgba(234, 179, 8, 0.1)',
              borderLeft: '4px solid #eab308',
              padding: '12px 14px',
              borderRadius: '4px',
              marginBottom: '14px',
            }}
          >
            <div style={{ fontWeight: 600, color: '#facc15', marginBottom: '4px' }}>
              🎓 Empfohlene Lern-Ressource: Random Nerd Tutorials
            </div>
            Ausgezeichnete kostenlose Tutorials, Anleitungen und Praxisprojekte für ESP32, ESP8266, Sensorik und IoT von Sara & Rui Santos:
            <div style={{ marginTop: '6px' }}>
              <a
                href="https://randomnerdtutorials.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#facc15', textDecoration: 'underline', fontWeight: 600 }}
              >
                Random Nerd Tutorials besuchen (https://randomnerdtutorials.com/) &rarr;
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
            <div style={{ fontWeight: 600, color: '#c084fc', marginBottom: '4px' }}>
              🤖 KI-gestützte Entwicklung mit Antigravity:
            </div>
            Sämtliche Modifikationen, Erweiterungen, Refactorings und Fehlerbehebungen an diesem Projekt wurden in kooperativer Entwicklung unter Einsatz des KI-Assistenten <strong>Antigravity</strong> (Google DeepMind) durchgeführt.
          </div>

          {/* Markenhinweis / Trademark Disclaimer */}
          <div
            style={{
              backgroundColor: '#13161c',
              border: '1px solid #282e3d',
              padding: '12px 14px',
              borderRadius: '6px',
              marginBottom: '14px',
            }}
          >
            <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>
              ⚖️ Markenhinweis & Rechteinhaber:
            </div>
            Alle genannten Markennamen, Warenzeichen, Logos und Produktbezeichnungen (wie z. B. <em>Arduino, ESP32, Espressif, Raspberry Pi, MicroPython, SAMD, RP2040</em>) sind Eigentum der jeweiligen Rechteinhaber. Pinslim ist ein unabhängiges Open-Source-Projekt und steht in keinerlei Verbindung, Sponsoring oder geschäftlichen Beziehung zu diesen Rechteinhabern.
          </div>

          {/* Partner & Sponsoren Hinweis */}
          <div
            style={{
              backgroundColor: '#13161c',
              border: '1px solid #282e3d',
              padding: '12px 14px',
              borderRadius: '6px',
              marginBottom: '14px',
            }}
          >
            <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>
              🤝 Hinweis zu Partnern & Sponsoren:
            </div>
            Sämtliche im ursprünglichen Velxio-Projekt genannten Partner, Sponsoren oder Werbepartner gehören ausschließlich zum Projekt von David Montero Crespo / Velxio und sind <strong>keine Partner oder Sponsoren von Pinslim</strong>.
          </div>

          {/* Lizenz & Haftungsausschluss */}
          <div
            style={{
              backgroundColor: '#13161c',
              border: '1px solid #282e3d',
              padding: '12px 14px',
              borderRadius: '6px',
              marginBottom: '14px',
            }}
          >
            <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>
              📄 Lizenz & Haftungsausschluss:
            </div>
            Pinslim wird unter den Bedingungen der <strong>GNU Affero General Public License v3.0 (AGPLv3)</strong> bereitgestellt. Die Software wird &quot;WIE SIE IST&quot; (AS IS) ohne jegliche ausdrückliche oder stillschweigende Gewährleistung oder Haftung zur Verfügung gestellt.
          </div>

          {/* Features */}
          <h4 style={{ color: '#f0f4f8', marginBottom: '8px', marginTop: '16px', fontSize: '13px' }}>
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
              backgroundColor: '#00E5FF',
              color: '#000000',
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
