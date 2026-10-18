/**
 * Export Schematic Canvas as crisp PNG image (Client-side)
 * Bulletproof, high-DPI rendering that works across all browsers without security errors.
 */

import { useSimulatorStore } from '../store/useSimulatorStore';
import { ComponentRegistry } from '../services/ComponentRegistry';
import { BOARD_KIND_LABELS } from '../types/board';

export async function exportSchematicPng(): Promise<void> {
  const simStore = useSimulatorStore.getState();
  const { boards, components, wires } = simStore;

  if (boards.length === 0 && components.length === 0) {
    alert('Der Schaltplan ist leer. Bitte füge zuerst ein Bauteil oder Board hinzu.');
    return;
  }

  // 1. Determine bounding box of all items
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  boards.forEach((b) => {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + 280);
    maxY = Math.max(maxY, b.y + 200);
  });

  components.forEach((c) => {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + 120);
    maxY = Math.max(maxY, c.y + 120);
  });

  if (!isFinite(minX)) minX = 0;
  if (!isFinite(minY)) minY = 0;
  if (!isFinite(maxX)) maxX = 800;
  if (!isFinite(maxY)) maxY = 600;

  const padding = 60;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const width = Math.max(500, Math.ceil(maxX - minX));
  const height = Math.max(400, Math.ceil(maxY - minY));

  // 2. Prepare HD Canvas (2x scale for Retina sharpness)
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context output not available');

  ctx.scale(scale, scale);

  const isLight = document.body.classList.contains('light-theme');

  // Background Fill
  ctx.fillStyle = isLight ? '#f8fafc' : '#141619';
  ctx.fillRect(0, 0, width, height);

  // Background Grid Pattern
  ctx.strokeStyle = isLight ? 'rgba(203, 213, 225, 0.5)' : 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  const gridSize = 20;
  for (let x = (minX % gridSize); x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = (minY % gridSize); y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Translate to origin minX, minY
  ctx.save();
  ctx.translate(-minX, -minY);

  // 3. Render Wires Layer
  const wireSvg = document.querySelector('.wire-layer-svg') as SVGElement | null;
  if (wireSvg) {
    const paths = Array.from(wireSvg.querySelectorAll('path'));
    paths.forEach((p) => {
      const d = p.getAttribute('d');
      if (!d) return;
      const stroke = p.getAttribute('stroke') || p.style.stroke || '#00E5FF';
      const strokeWidthStr = p.getAttribute('stroke-width') || p.style.strokeWidth || '3';
      const strokeWidth = parseFloat(strokeWidthStr) || 3;

      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = stroke;
      ctx.shadowBlur = isLight ? 0 : 4;

      try {
        const path2d = new Path2D(d);
        ctx.stroke(path2d);
      } catch {
        // Fallback if Path2D parsing fails
      }
      ctx.restore();
    });

    // Render wire pin dots/circles
    const circles = Array.from(wireSvg.querySelectorAll('circle'));
    circles.forEach((c) => {
      const cx = parseFloat(c.getAttribute('cx') || '0');
      const cy = parseFloat(c.getAttribute('cy') || '0');
      const r = parseFloat(c.getAttribute('r') || '4');
      const fill = c.getAttribute('fill') || '#ffffff';

      ctx.save();
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // 4. Render Microcontroller Boards
  boards.forEach((board) => {
    const label = BOARD_KIND_LABELS[board.boardKind] || board.boardKind;
    const bWidth = 240;
    const bHeight = 160;

    ctx.save();
    // Board container card
    ctx.fillStyle = isLight ? '#ffffff' : '#1e2026';
    ctx.strokeStyle = isLight ? '#0071e3' : '#00e5ff';
    ctx.lineWidth = 2;

    // Rounded rectangle
    const rx = board.x;
    const ry = board.y;
    const rw = bWidth;
    const rh = bHeight;
    const radius = 10;

    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, radius);
    ctx.fill();
    ctx.stroke();

    // Board Header Accent Strip
    ctx.fillStyle = isLight ? '#0071e3' : '#00e5ff';
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, 32, [radius, radius, 0, 0]);
    ctx.fill();

    // Board Header Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(label.toUpperCase(), rx + 14, ry + 21);

    // Subtitle / Kind
    ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(`ID: ${board.id}`, rx + 14, ry + 52);
    ctx.fillText(`Typ: ${board.boardKind}`, rx + 14, ry + 68);

    ctx.restore();
  });

  // 5. Render Components
  const registry = ComponentRegistry.getInstance();
  components.forEach((comp) => {
    const meta = registry.getById(comp.type) || registry.getByTagName(comp.type);
    const compName = meta?.name || comp.name || comp.type;
    const cWidth = 110;
    const cHeight = 80;

    ctx.save();
    const cx = comp.x;
    const cy = comp.y;

    // Component box
    ctx.fillStyle = isLight ? '#ffffff' : '#22252e';
    ctx.strokeStyle = isLight ? '#cbd5e1' : '#3b4252';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.roundRect(cx, cy, cWidth, cHeight, 8);
    ctx.fill();
    ctx.stroke();

    // Component Icon / Tag
    ctx.fillStyle = isLight ? '#0071e3' : '#38bdf8';
    ctx.font = 'bold 11px system-ui, sans-serif';
    const compTitle = comp.name || compName;
    ctx.fillText(compTitle.length > 13 ? compTitle.slice(0, 12) + '…' : compTitle, cx + 10, cy + 24);

    // Details / Properties
    ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
    ctx.font = '10px system-ui, sans-serif';

    const props = comp.properties || {};
    if (props.value) {
      ctx.fillText(`Wert: ${props.value}`, cx + 10, cy + 44);
    } else if (props.color) {
      ctx.fillText(`Farbe: ${props.color}`, cx + 10, cy + 44);
    } else {
      ctx.fillText(`Typ: ${comp.type}`, cx + 10, cy + 44);
    }

    ctx.restore();
  });

  ctx.restore(); // Restore transform offset

  // 6. Add Velxio Pinslim Watermark / Branding Badge
  const dateStr = new Date().toLocaleDateString('de-DE');
  ctx.save();
  ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('⚡ Velxio Pinslim — Schaltplan Export', 18, height - 18);

  ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(dateStr, width - 90, height - 18);
  ctx.restore();

  // 7. Download PNG image
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schaltplan-pinslim-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
