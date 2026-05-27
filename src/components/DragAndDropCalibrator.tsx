import { useState, useRef, useCallback, useEffect } from 'react';
import templateP1 from '../assets/template_p1.jpg';
import templateP2 from '../assets/template_p2.jpg';

// =============================================================================
// TYPES
// =============================================================================

interface FieldConfig {
  id: string;
  label: string;
  x_px: number;
  y_px: number;
  width_px?: number;
  height_px?: number;
  isResizable?: boolean;
  color: string;
  page: 1 | 2;
}

// =============================================================================
// INITIAL FIELD POSITIONS (in pixels — will be converted to mm)
// =============================================================================

const INITIAL_FIELDS: FieldConfig[] = [
  // Page 1
  { id: 'unidade_contrato', label: 'Unidade / Contrato', x_px: 246, y_px: 272, color: '#ef4444', page: 1 },
  { id: 'data', label: 'Data', x_px: 170, y_px: 310, color: '#f97316', page: 1 },
  { id: 'encarregado', label: 'Encarregado', x_px: 284, y_px: 348, color: '#eab308', page: 1 },
  { id: 'objeto_visita', label: 'Objeto da Visita', x_px: 95, y_px: 510, color: '#22c55e', page: 1 },
  { id: 'observacoes', label: 'Observações', x_px: 95, y_px: 586, color: '#3b82f6', page: 1 },
  // Page 2
  { id: 'foto_biometria', label: '📷 Foto Biométrica', x_px: 227, y_px: 170, width_px: 340, height_px: 255, isResizable: true, color: '#a855f7', page: 2 },
  { id: 'assinatura_encarregado', label: 'Assinatura Encarregado', x_px: 227, y_px: 795, color: '#ec4899', page: 2 },
];

// A4 canvas dimensions (keeping exact 210/297 ratio)
const CANVAS_W = 794;
const CANVAS_H = Math.round(CANVAS_W * (297 / 210)); // ≈ 1123

const toMM_X = (px: number) => Math.round(((px / CANVAS_W) * 210) * 10) / 10;
const toMM_Y = (px: number) => Math.round(((px / CANVAS_H) * 297) * 10) / 10;
const toMM_W = (px: number) => Math.round(((px / CANVAS_W) * 210) * 10) / 10;
const toMM_H = (px: number) => Math.round(((px / CANVAS_H) * 297) * 10) / 10;

// =============================================================================
// COMPONENT
// =============================================================================

export default function DragAndDropCalibrator() {
  const [fields, setFields] = useState<FieldConfig[]>(INITIAL_FIELDS);
  const [activePage, setActivePage] = useState<1 | 2>(1);
  const [dragging, setDragging] = useState<string | null>(null);
  const [resizing, setResizing] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Drag logic ──────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent, fieldId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const field = fields.find(f => f.id === fieldId)!;
    dragOffset.current = { x: e.clientX - field.x_px, y: e.clientY - field.y_px };
    setDragging(fieldId);
  }, [fields]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, fieldId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(fieldId);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    if (dragging) {
      const newX = Math.max(0, Math.min(e.clientX - dragOffset.current.x, CANVAS_W - 20));
      const newY = Math.max(0, Math.min(e.clientY - dragOffset.current.y, CANVAS_H - 20));
      setFields(prev => prev.map(f =>
        f.id === dragging ? { ...f, x_px: newX, y_px: newY } : f
      ));
    }

    if (resizing) {
      const field = fields.find(f => f.id === resizing)!;
      const newW = Math.max(40, e.clientX - rect.left - field.x_px);
      const newH = Math.max(30, e.clientY - rect.top - field.y_px);
      setFields(prev => prev.map(f =>
        f.id === resizing ? { ...f, width_px: newW, height_px: newH } : f
      ));
    }
  }, [dragging, resizing, fields]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setResizing(null);
  }, []);

  // ── Generate config code ────────────────────────────────────────────────
  const generateConfig = () => {
    const p1 = fields.filter(f => f.page === 1);
    const p2 = fields.filter(f => f.page === 2);

    let code = `const PDF_CONFIG = {\n`;
    code += `  font: {\n    family: 'helvetica',\n    style: 'normal',\n    size: 11,\n    color: { r: 0, g: 0, b: 0 },\n  },\n`;
    code += `  page: { width: 210, height: 297 },\n\n`;

    code += `  pagina1: {\n`;
    for (const f of p1) {
      if (f.id === 'observacoes') {
        code += `    ${f.id}: { x: ${toMM_X(f.x_px)}, y: ${toMM_Y(f.y_px)}, maxWidth: 170 },\n`;
      } else {
        code += `    ${f.id}: { x: ${toMM_X(f.x_px)}, y: ${toMM_Y(f.y_px)} },\n`;
      }
    }
    code += `  },\n\n`;

    code += `  pagina2: {\n`;
    for (const f of p2) {
      if (f.isResizable) {
        code += `    ${f.id}: { x: ${toMM_X(f.x_px)}, y: ${toMM_Y(f.y_px)}, width: ${toMM_W(f.width_px || 340)}, height: ${toMM_H(f.height_px || 255)} },\n`;
      } else {
        code += `    ${f.id}: { x: ${toMM_X(f.x_px)}, y: ${toMM_Y(f.y_px)} },\n`;
      }
    }
    code += `  },\n`;
    code += `};\n`;

    return code;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generateConfig());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Keyboard shortcut: 1 / 2 to switch pages ───────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '1') setActivePage(1);
      if (e.key === '2') setActivePage(2);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const currentFields = fields.filter(f => f.page === activePage);
  const bgImage = activePage === 1 ? templateP1 : templateP2;

  return (
    <div style={{
      display: 'flex',
      gap: 24,
      padding: 24,
      background: '#0f172a',
      minHeight: '100vh',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      color: '#e2e8f0',
    }}>

      {/* ── LEFT: A4 Canvas ──────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0 }}>

        {/* Page tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[1, 2].map(p => (
            <button
              key={p}
              onClick={() => setActivePage(p as 1 | 2)}
              style={{
                padding: '8px 24px',
                borderRadius: 8,
                border: 'none',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                background: activePage === p ? '#3b82f6' : '#1e293b',
                color: activePage === p ? '#fff' : '#94a3b8',
                transition: 'all 0.2s',
              }}
            >
              Página {p}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b', alignSelf: 'center' }}>
            Press <kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>1</kbd> or{' '}
            <kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>2</kbd> to switch
          </span>
        </div>

        {/* A4 canvas */}
        <div
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            position: 'relative',
            width: CANVAS_W / 1.5,   // Scale down to fit screen
            height: CANVAS_H / 1.5,
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: 8,
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            cursor: dragging || resizing ? 'grabbing' : 'default',
            userSelect: 'none',
          }}
        >
          {/* Grid overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `
              linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px)
            `,
            backgroundSize: `${CANVAS_W / 1.5 / 21}px ${CANVAS_H / 1.5 / 29.7}px`,
            pointerEvents: 'none',
          }} />

          {currentFields.map(field => {
            const scale = 1 / 1.5;
            const left = field.x_px * scale;
            const top = field.y_px * scale;
            const w = field.width_px ? field.width_px * scale : undefined;
            const h = field.height_px ? field.height_px * scale : undefined;

            return (
              <div
                key={field.id}
                onMouseDown={(e) => handleMouseDown(e, field.id)}
                style={{
                  position: 'absolute',
                  left, top,
                  width: w,
                  height: h,
                  minWidth: field.isResizable ? undefined : 'max-content',
                  background: field.isResizable
                    ? `${field.color}22`
                    : 'transparent',
                  border: `2px ${field.isResizable ? 'dashed' : 'solid'} ${field.color}`,
                  borderRadius: 4,
                  cursor: 'grab',
                  display: 'flex',
                  alignItems: field.isResizable ? 'center' : undefined,
                  justifyContent: field.isResizable ? 'center' : undefined,
                  zIndex: dragging === field.id ? 100 : 10,
                }}
              >
                {/* Label tag */}
                <span style={{
                  background: field.color,
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: field.isResizable ? 4 : '0 0 4px 0',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  letterSpacing: 0.3,
                }}>
                  {field.label}
                  <span style={{ opacity: 0.7, marginLeft: 4 }}>
                    ({toMM_X(field.x_px)}, {toMM_Y(field.y_px)})
                  </span>
                </span>

                {/* Resize handle */}
                {field.isResizable && (
                  <div
                    onMouseDown={(e) => handleResizeMouseDown(e, field.id)}
                    style={{
                      position: 'absolute',
                      right: -4, bottom: -4,
                      width: 14, height: 14,
                      background: field.color,
                      borderRadius: '0 0 4px 0',
                      cursor: 'nwse-resize',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 8,
                      color: '#fff',
                    }}
                  >
                    ⤡
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT: Config Panel ──────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        minWidth: 360,
        maxWidth: 500,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>

        {/* Title */}
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#f8fafc' }}>
            📐 PDF Calibrator
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Drag fields over the template. Copy the config when aligned.
          </p>
        </div>

        {/* Field cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
          {fields.map(f => (
            <div
              key={f.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: activePage === f.page ? '#1e293b' : '#0f172a',
                borderRadius: 8,
                border: `1px solid ${activePage === f.page ? f.color + '44' : '#1e293b'}`,
                opacity: activePage === f.page ? 1 : 0.4,
                transition: 'all 0.2s',
              }}
            >
              <div style={{
                width: 10, height: 10,
                borderRadius: '50%',
                background: f.color,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{f.label}</span>
              <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                x:{toMM_X(f.x_px)} y:{toMM_Y(f.y_px)}
                {f.isResizable && ` w:${toMM_W(f.width_px!)} h:${toMM_H(f.height_px!)}`}
              </span>
              <span style={{
                fontSize: 9, background: '#334155', padding: '2px 6px',
                borderRadius: 4, color: '#94a3b8',
              }}>
                P{f.page}
              </span>
            </div>
          ))}
        </div>

        {/* Code output */}
        <div style={{
          flex: 1,
          background: '#1e293b',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #334155',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            background: '#334155',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>
              📋 PDF_CONFIG (live)
            </span>
            <button
              onClick={handleCopy}
              style={{
                padding: '4px 14px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                background: copied ? '#22c55e' : '#3b82f6',
                color: '#fff',
                transition: 'all 0.2s',
              }}
            >
              {copied ? '✓ Copied!' : 'Copy Code'}
            </button>
          </div>
          <pre style={{
            margin: 0,
            padding: 16,
            fontSize: 12,
            lineHeight: 1.6,
            overflowY: 'auto',
            color: '#e2e8f0',
            fontFamily: "'Fira Code', 'Cascadia Code', monospace",
          }}>
            {generateConfig()}
          </pre>
        </div>

        {/* Instructions */}
        <div style={{
          padding: 16,
          background: '#1e293b',
          borderRadius: 12,
          border: '1px solid #334155',
        }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#f97316', marginBottom: 6 }}>
            💡 How to use:
          </p>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#94a3b8', lineHeight: 1.8 }}>
            <li><strong>Drag</strong> any colored label to move it over the template lines</li>
            <li><strong>Resize</strong> the 📷 Photo box using the corner handle</li>
            <li>Press <strong>1</strong> or <strong>2</strong> to switch pages</li>
            <li>Click <strong>Copy Code</strong> and paste into <code style={{ background: '#334155', padding: '1px 4px', borderRadius: 3 }}>gerarPdf.ts</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
