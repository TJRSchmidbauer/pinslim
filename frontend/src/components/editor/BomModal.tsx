import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { BOARD_KIND_LABELS } from '../../types/board';
import { ComponentRegistry } from '../../services/ComponentRegistry';
import { isBoardComponent } from '../../utils/boardPinMapping';
import './BomModal.css';

interface BomItem {
  id: string;
  designator: string;
  name: string;
  category: string;
  quantity: number;
  connectionsCount: number;
  details: string;
}

interface BomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Fallback human-readable translations for common component types */
const KNOWN_COMPONENT_NAMES: Record<string, { name: string; category: string }> = {
  // Sensors
  'photoresistor-sensor': { name: 'Photoresistor Lichtsensor (LDR)', category: 'Sensoren' },
  'wokwi-photoresistor-sensor': { name: 'Photoresistor Lichtsensor (LDR)', category: 'Sensoren' },
  'photoresistor': { name: 'Fotowiderstand (LDR)', category: 'Sensoren' },
  'wokwi-photoresistor': { name: 'Fotowiderstand (LDR)', category: 'Sensoren' },
  'ntc-temperature-sensor': { name: 'NTC Temperatursensor', category: 'Sensoren' },
  'wokwi-ntc-temperature-sensor': { name: 'NTC Temperatursensor', category: 'Sensoren' },
  'dht11': { name: 'DHT11 Temperatur & Luftfeuchte Sensor', category: 'Sensoren' },
  'wokwi-dht11': { name: 'DHT11 Temperatur & Luftfeuchte Sensor', category: 'Sensoren' },
  'dht22': { name: 'DHT22 Temperatur & Luftfeuchte Sensor', category: 'Sensoren' },
  'wokwi-dht22': { name: 'DHT22 Temperatur & Luftfeuchte Sensor', category: 'Sensoren' },
  'hc-sr04': { name: 'Ultraschallsensor HC-SR04', category: 'Sensoren' },
  'wokwi-hc-sr04': { name: 'Ultraschallsensor HC-SR04', category: 'Sensoren' },
  'mpu6050': { name: 'MPU6050 Gyroscope & Accelerometer', category: 'Sensoren' },
  'wokwi-mpu6050': { name: 'MPU6050 Gyroscope & Accelerometer', category: 'Sensoren' },
  'pir-motion-sensor': { name: 'PIR Bewegungssensor', category: 'Sensoren' },
  'wokwi-pir-motion-sensor': { name: 'PIR Bewegungssensor', category: 'Sensoren' },

  // Passive & Basic Components
  'resistor': { name: 'Widerstand', category: 'Passiv' },
  'wokwi-resistor': { name: 'Widerstand', category: 'Passiv' },
  'potentiometer': { name: 'Potentiometer (Drehwiderstand)', category: 'Passiv' },
  'wokwi-potentiometer': { name: 'Potentiometer (Drehwiderstand)', category: 'Passiv' },
  'capacitor': { name: 'Kondensator', category: 'Passiv' },
  'wokwi-capacitor': { name: 'Kondensator', category: 'Passiv' },
  'led': { name: 'LED (Leuchtdiode)', category: 'Optoelektronik' },
  'wokwi-led': { name: 'LED (Leuchtdiode)', category: 'Optoelektronik' },
  'pushbutton': { name: 'Taster (Pushbutton)', category: 'Eingabe' },
  'wokwi-pushbutton': { name: 'Taster (Pushbutton)', category: 'Eingabe' },
  'button': { name: 'Taster (Pushbutton)', category: 'Eingabe' },

  // Active & Discrete Devices
  'bjt-2n2222': { name: 'NPN Transistor (2N2222)', category: 'Diskrete Halbleiter' },
  'wokwi-bjt-2n2222': { name: 'NPN Transistor (2N2222)', category: 'Diskrete Halbleiter' },
  'bjt-2n3906': { name: 'PNP Transistor (2N3906)', category: 'Diskrete Halbleiter' },
  'wokwi-bjt-2n3906': { name: 'PNP Transistor (2N3906)', category: 'Diskrete Halbleiter' },
  'mosfet-2n7000': { name: 'N-Kanal MOSFET (2N7000)', category: 'Diskrete Halbleiter' },
  'wokwi-mosfet-2n7000': { name: 'N-Kanal MOSFET (2N7000)', category: 'Diskrete Halbleiter' },
  'opamp-lm358': { name: 'LM358 Operationsverstärker', category: 'Analog-IC' },
  'wokwi-opamp-lm358': { name: 'LM358 Operationsverstärker', category: 'Analog-IC' },
  'diode-1n4007': { name: 'Diode 1N4007', category: 'Diskrete Halbleiter' },
  'wokwi-diode-1n4007': { name: 'Diode 1N4007', category: 'Diskrete Halbleiter' },
  'zener-1n4733': { name: 'Zener-Diode 5.1V (1N4733)', category: 'Diskrete Halbleiter' },
  'wokwi-zener-1n4733': { name: 'Zener-Diode 5.1V (1N4733)', category: 'Diskrete Halbleiter' },

  // Displays & Actuators
  'lcd1602': { name: 'LCD Display 16x2', category: 'Displays' },
  'wokwi-lcd1602': { name: 'LCD Display 16x2', category: 'Displays' },
  'lcd2004': { name: 'LCD Display 20x4', category: 'Displays' },
  'wokwi-lcd2004': { name: 'LCD Display 20x4', category: 'Displays' },
  'servo': { name: 'Servomotor', category: 'Aktoren' },
  'wokwi-servo': { name: 'Servomotor', category: 'Aktoren' },
  'buzzer': { name: 'Piezo Buzzer / Lautsprecher', category: 'Aktoren' },
  'wokwi-buzzer': { name: 'Piezo Buzzer / Lautsprecher', category: 'Aktoren' },
  'battery-9v': { name: '9V Batterie (Stromversorgung)', category: 'Stromversorgung' },
  'wokwi-battery-9v': { name: '9V Batterie (Stromversorgung)', category: 'Stromversorgung' },

  // Boards
  'arduino-uno': { name: 'Arduino Uno R3', category: 'Microcontroller / Board' },
  'wokwi-arduino-uno': { name: 'Arduino Uno R3', category: 'Microcontroller / Board' },
  'arduino-nano': { name: 'Arduino Nano', category: 'Microcontroller / Board' },
  'wokwi-arduino-nano': { name: 'Arduino Nano', category: 'Microcontroller / Board' },
  'arduino-mega': { name: 'Arduino Mega 2560', category: 'Microcontroller / Board' },
  'wokwi-arduino-mega': { name: 'Arduino Mega 2560', category: 'Microcontroller / Board' },
  'esp32-devkit-v1': { name: 'ESP32 DevKit V1', category: 'Microcontroller / Board' },
  'wokwi-esp32-devkit-v1': { name: 'ESP32 DevKit V1', category: 'Microcontroller / Board' },
  'esp32c3': { name: 'ESP32-C3 DevKit', category: 'Microcontroller / Board' },
};

export const BomModal: React.FC<BomModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { boards, components, wires } = useSimulatorStore();
  const [activeTab, setActiveTab] = useState<'table' | 'csv'>('table');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Calculate connection counts per component/board id from wires
  const connectionCounts = new Map<string, number>();
  wires.forEach((wire) => {
    const startId = wire.start?.componentId;
    const endId = wire.end?.componentId;
    if (startId) connectionCounts.set(startId, (connectionCounts.get(startId) || 0) + 1);
    if (endId) connectionCounts.set(endId, (connectionCounts.get(endId) || 0) + 1);
  });

  const bomItems: BomItem[] = [];
  const processedIds = new Set<string>();

  // 1. Process Microcontroller Boards
  boards.forEach((board, index) => {
    processedIds.add(board.id);
    const label = BOARD_KIND_LABELS[board.boardKind] || board.boardKind || 'Microcontroller';
    const des = `BOARD_${index + 1}`;
    const wireCount = connectionCounts.get(board.id) || 0;
    bomItems.push({
      id: board.id,
      designator: des,
      name: label,
      category: 'Microcontroller / Board',
      quantity: 1,
      connectionsCount: wireCount,
      details: `Modell: ${board.boardKind}`,
    });
  });

  // 2. Process Components (including any board components placed inside components list)
  const registry = ComponentRegistry.getInstance();
  components.forEach((comp, index) => {
    if (processedIds.has(comp.id)) return;
    processedIds.add(comp.id);

    const compType = comp.type || 'unknown';
    const cleanType = compType.replace(/^(wokwi|velxio)-/, '');
    const known = KNOWN_COMPONENT_NAMES[compType] || KNOWN_COMPONENT_NAMES[cleanType];

    const meta = registry.getById(compType) || registry.getById(cleanType);
    
    let compName = comp.name || meta?.name || known?.name || cleanType;
    let compCategory = meta ? ComponentRegistry.getCategoryDisplayName(meta.category) : known?.category || 'Elektronikbauteil';

    // If component is actually a board
    if (isBoardComponent(comp.id) || isBoardComponent(compType) || isBoardComponent(cleanType)) {
      compCategory = 'Microcontroller / Board';
      if (cleanType.includes('arduino-uno')) compName = 'Arduino Uno R3';
      if (cleanType.includes('arduino-mega')) compName = 'Arduino Mega 2560';
      if (cleanType.includes('esp32')) compName = 'ESP32 DevKit';
    }

    const wireCount = connectionCounts.get(comp.id) || 0;

    // Build human-readable details summary from properties
    const props = comp.properties || {};
    const propDetails: string[] = [];

    if (props.lux !== undefined) propDetails.push(`Lichtwert: ${props.lux} Lux`);
    if (props.dark !== undefined) propDetails.push(`Dunkel-R: ${props.dark}`);
    if (props.pullup !== undefined) propDetails.push(`Pullup: ${props.pullup}`);
    if (props.value !== undefined) propDetails.push(`Wert: ${props.value}`);
    if (props.color !== undefined) propDetails.push(`Farbe: ${props.color}`);
    if (props.temperature !== undefined) propDetails.push(`Temperatur: ${props.temperature} °C`);
    if (props.key !== undefined) propDetails.push(`Key: ${props.key}`);
    if (props.label !== undefined) propDetails.push(`Label: ${props.label}`);

    const detailsStr = propDetails.length > 0 ? propDetails.join(', ') : `Typ: ${cleanType}`;
    const des = comp.id || `COMP_${index + 1}`;

    bomItems.push({
      id: comp.id,
      designator: des,
      name: compName,
      category: compCategory,
      quantity: 1,
      connectionsCount: wireCount,
      details: detailsStr,
    });
  });

  // Generate CSV text content
  const dateStr = new Date().toISOString().split('T')[0];
  let csvRaw = `"Pos.";"ID / Bezeichner";"Bauteil / Board";"Kategorie";"Anzahl";"Verbindungen";"Spezifikation & Details"\n`;
  bomItems.forEach((item, index) => {
    const connStr = item.connectionsCount > 0 ? `${item.connectionsCount} Wires angeschlossen` : 'Frei';
    csvRaw += `"${index + 1}";"${item.designator}";"${item.name.replace(/"/g, '""')}";"${item.category.replace(/"/g, '""')}";"${item.quantity}";"${connStr}";"${item.details.replace(/"/g, '""')}"\n`;
  });

  const handleCopyCsv = () => {
    navigator.clipboard.writeText(csvRaw).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleDownloadCsv = () => {
    const blob = new Blob(['\uFEFF' + csvRaw], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stueckliste-pinslim-${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <div className="bom-modal-overlay" onClick={onClose}>
      <div className="bom-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bom-modal-header">
          <div className="bom-header-title">
            <span className="bom-header-icon">📋</span>
            <h2>Stückliste / Bill of Materials (BOM)</h2>
          </div>
          <button className="bom-modal-close" onClick={onClose} title="Schließen">
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bom-modal-tabs">
          <button
            className={`bom-tab ${activeTab === 'table' ? 'active' : ''}`}
            onClick={() => setActiveTab('table')}
          >
            📊 Tabellenansicht ({bomItems.length} Bauteile)
          </button>
          <button
            className={`bom-tab ${activeTab === 'csv' ? 'active' : ''}`}
            onClick={() => setActiveTab('csv')}
          >
            📄 CSV Code-Vorschau
          </button>
        </div>

        {/* Modal Body */}
        <div className="bom-modal-body">
          {bomItems.length === 0 ? (
            <div className="bom-empty-state">
              <span className="bom-empty-icon">🔌</span>
              <p className="bom-empty-msg">
                Keine Bauteile oder Boards auf dem Schaltplan vorhanden.
              </p>
              <span className="bom-empty-hint">Füge Bauteile aus dem Bauteile-Picker hinzu, um eine Stückliste zu generieren.</span>
            </div>
          ) : activeTab === 'table' ? (
            <div className="bom-table-wrapper">
              <table className="bom-table">
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>ID / Name</th>
                    <th>Bauteil</th>
                    <th>Kategorie</th>
                    <th>Anzahl</th>
                    <th>Verbindung</th>
                    <th>Spezifikation / Details</th>
                  </tr>
                </thead>
                <tbody>
                  {bomItems.map((item, index) => (
                    <tr key={item.id}>
                      <td className="bom-td-pos">{index + 1}</td>
                      <td className="bom-td-des">
                        <code>{item.designator}</code>
                      </td>
                      <td className="bom-item-name">{item.name}</td>
                      <td className="bom-td-cat">{item.category}</td>
                      <td className="bom-item-qty">{item.quantity}</td>
                      <td>
                        <span className={`bom-conn-pill ${item.connectionsCount > 0 ? 'connected' : 'unconnected'}`}>
                          {item.connectionsCount > 0 ? `⚡ ${item.connectionsCount} Wires` : 'Frei'}
                        </span>
                      </td>
                      <td className="bom-item-details">{item.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bom-csv-preview-container">
              <div className="bom-csv-toolbar">
                <span className="bom-csv-label">CSV-Format (mit UTF-8 BOM, Trennzeichen Semikolon):</span>
                <button className="bom-btn bom-btn-copy" onClick={handleCopyCsv}>
                  {copied ? '✅ Kopiert!' : '📋 CSV Code kopieren'}
                </button>
              </div>
              <textarea
                className="bom-csv-textarea"
                value={csvRaw}
                readOnly
                rows={12}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bom-modal-footer">
          <button
            className="bom-btn bom-btn-primary"
            onClick={handleDownloadCsv}
            disabled={bomItems.length === 0}
          >
            📥 CSV-Datei herunterladen
          </button>
          <button
            className="bom-btn bom-btn-secondary"
            onClick={handleCopyCsv}
            disabled={bomItems.length === 0}
          >
            {copied ? '✅ Kopiert!' : '📋 Code kopieren'}
          </button>
          <button className="bom-btn bom-btn-cancel" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
