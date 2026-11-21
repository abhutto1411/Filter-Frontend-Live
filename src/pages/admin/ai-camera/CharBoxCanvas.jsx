import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const CHAR_CLASSES = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * Canvas-based character box drawing tool for plate crop images.
 *
 * - Left-click + drag to draw a new box → char picker appears
 * - Click an existing box to change its character
 * - Right-click a box to delete it
 * - Green dashed = Pi prediction, yellow solid = human-drawn
 */
export default function CharBoxCanvas({
  imageUrl,
  imageWidth,
  imageHeight,
  boxes,
  onChange,
  predictedBoxes,
}) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [drawing, setDrawing] = useState(null);
  const [hovered, setHovered] = useState(-1);
  const [pickerBox, setPickerBox] = useState(null); // { index, x, y } for char picker
  const [pickerFilter, setPickerFilter] = useState('');
  const pickerRef = useRef(null);

  // Scale the tiny plate crop up so boxes are easy to draw
  const scale = useMemo(() => {
    if (!imageWidth || !imageHeight) return 4;
    const minW = 600;
    const maxW = 900;
    const s = Math.max(minW / imageWidth, 2);
    return Math.min(s, maxW / imageWidth, 8);
  }, [imageWidth, imageHeight]);

  const canvasW = Math.round((imageWidth || 200) * scale);
  const canvasH = Math.round((imageHeight || 60) * scale);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !loaded) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, canvasW, canvasH);

    // Pi predicted boxes (dashed green)
    if (predictedBoxes?.length) {
      ctx.strokeStyle = 'rgba(40, 180, 40, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      for (const b of predictedBoxes) {
        ctx.strokeRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
        if (b.char) {
          ctx.font = `bold ${Math.max(11, 14 * scale / 4)}px monospace`;
          ctx.fillStyle = 'rgba(40, 180, 40, 0.7)';
          ctx.fillText(b.char, b.x * scale + 2, Math.max(10, b.y * scale - 3));
        }
      }
      ctx.setLineDash([]);
    }

    // Human-drawn boxes (solid yellow)
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const isHover = i === hovered;
      const isPickerTarget = pickerBox?.index === i;
      ctx.strokeStyle = isPickerTarget ? '#60A5FA' : isHover ? '#EF4444' : '#FBBF24';
      ctx.lineWidth = isPickerTarget ? 3 : isHover ? 3 : 2;
      ctx.strokeRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
      ctx.fillStyle = isPickerTarget
        ? 'rgba(96,165,250,0.15)'
        : isHover
          ? 'rgba(239,68,68,0.12)'
          : 'rgba(251,191,36,0.08)';
      ctx.fillRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
      // Char label
      if (b.char) {
        const fontSize = Math.max(13, 18 * scale / 4);
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.fillStyle = isPickerTarget ? '#60A5FA' : isHover ? '#EF4444' : '#FBBF24';
        const labelY = b.y * scale - 4;
        ctx.fillText(b.char, b.x * scale + 2, labelY > fontSize ? labelY : b.y * scale + b.h * scale + fontSize + 2);
      }
    }

    // Active draw
    if (drawing) {
      ctx.strokeStyle = '#60A5FA';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(drawing.x * scale, drawing.y * scale, drawing.w * scale, drawing.h * scale);
      ctx.setLineDash([]);
    }
  }, [canvasW, canvasH, boxes, predictedBoxes, scale, loaded, drawing, hovered, pickerBox]);

  useEffect(() => { draw(); }, [draw]);

  const toImage = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  };

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    if (pickerBox != null) return; // picker is open
    const { x, y } = toImage(e);

    // Check if clicking an existing box to edit char
    for (let i = boxes.length - 1; i >= 0; i--) {
      const b = boxes[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        setPickerBox({
          index: i,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        setPickerFilter('');
        return;
      }
    }

    setDrawing({ startX: x, startY: y, x, y, w: 0, h: 0 });
  };

  const onMouseMove = (e) => {
    if (pickerBox != null) return;
    if (!drawing) {
      const { x, y } = toImage(e);
      let found = -1;
      for (let i = boxes.length - 1; i >= 0; i--) {
        const b = boxes[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { found = i; break; }
      }
      setHovered(found);
      return;
    }
    const { x, y } = toImage(e);
    setDrawing((prev) => ({
      ...prev,
      x: Math.min(prev.startX, x),
      y: Math.min(prev.startY, y),
      w: Math.abs(x - prev.startX),
      h: Math.abs(y - prev.startY),
    }));
  };

  const onMouseUp = (e) => {
    if (!drawing) return;
    const minSize = 4; // plate chars can be small
    if (drawing.w >= minSize && drawing.h >= minSize) {
      const newBox = {
        x: Math.round(drawing.x),
        y: Math.round(drawing.y),
        w: Math.round(drawing.w),
        h: Math.round(drawing.h),
        char: '',
        cls: 0,
      };
      const newBoxes = [...boxes, newBox];
      onChange(newBoxes);
      // Open char picker for the new box
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      setPickerBox({
        index: newBoxes.length - 1,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setPickerFilter('');
    }
    setDrawing(null);
  };

  const onContextMenu = (e) => {
    e.preventDefault();
    if (hovered >= 0) {
      onChange(boxes.filter((_, i) => i !== hovered));
      setHovered(-1);
      setPickerBox(null);
    }
  };

  const pickChar = (ch) => {
    if (pickerBox == null) return;
    const idx = pickerBox.index;
    const cls = CHAR_CLASSES.indexOf(ch.toUpperCase());
    const updated = boxes.map((b, i) =>
      i === idx ? { ...b, char: ch.toUpperCase(), cls: cls >= 0 ? cls : 0 } : b
    );
    onChange(updated);
    setPickerBox(null);
    setPickerFilter('');
  };

  const closePicker = () => {
    setPickerBox(null);
    setPickerFilter('');
  };

  // Focus picker input when opened
  useEffect(() => {
    if (pickerBox != null && pickerRef.current) {
      pickerRef.current.focus();
    }
  }, [pickerBox]);

  // Build label text from boxes (left-to-right)
  const labelFromBoxes = useMemo(() => {
    if (!boxes.length) return '';
    const sorted = [...boxes].sort((a, b) => a.x - b.x);
    return sorted.map((b) => b.char || '?').join('');
  }, [boxes]);

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <img
        ref={imgRef}
        src={imageUrl}
        style={{ display: 'none' }}
        onLoad={() => setLoaded(true)}
        alt=""
      />
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        style={{
          cursor: pickerBox != null ? 'default' : drawing ? 'crosshair' : hovered >= 0 ? 'pointer' : 'crosshair',
          border: '1px solid #374151',
          borderRadius: 8,
          maxWidth: '100%',
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { setDrawing(null); setHovered(-1); }}
        onContextMenu={onContextMenu}
      />

      {/* Character picker popup */}
      {pickerBox != null && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(pickerBox.x, canvasW - 220),
            top: pickerBox.y + 8,
            background: '#fff',
            border: '2px solid #6366F1',
            borderRadius: 10,
            padding: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            zIndex: 100,
            width: 210,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 4 }}>
            Pick character (or type it):
          </div>
          <input
            ref={pickerRef}
            type="text"
            maxLength={1}
            value={pickerFilter}
            onChange={(e) => {
              const v = e.target.value.toUpperCase().slice(-1);
              setPickerFilter(v);
              if (v && CHAR_CLASSES.includes(v)) {
                pickChar(v);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closePicker();
              if (e.key === 'Backspace' && !pickerFilter) closePicker();
            }}
            style={{
              width: '100%', padding: '4px 8px', border: '1px solid #D1D5DB',
              borderRadius: 6, fontSize: 16, fontFamily: 'monospace',
              textAlign: 'center', marginBottom: 6,
            }}
            placeholder="Type A-Z or 0-9"
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {CHAR_CLASSES.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => pickChar(ch)}
                style={{
                  width: 28, height: 28, border: '1px solid #E5E7EB',
                  borderRadius: 4, background: '#F9FAFB', cursor: 'pointer',
                  fontWeight: 700, fontSize: 13, fontFamily: 'monospace',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={(e) => { e.target.style.background = '#6366F1'; e.target.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.target.style.background = '#F9FAFB'; e.target.style.color = '#000'; }}
              >
                {ch}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={closePicker}
            style={{
              marginTop: 6, width: '100%', padding: '4px 0', border: '1px solid #D1D5DB',
              borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 11,
              fontWeight: 600, color: '#6B7280',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Info bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <div style={{ fontSize: 11, color: '#9CA3AF' }}>
          Draw box → pick char · Click box to relabel · Right-click to delete · Green dashed = Pi prediction
        </div>
        {labelFromBoxes && (
          <div style={{
            fontSize: 16, fontWeight: 700, fontFamily: 'monospace',
            color: '#111827', background: '#F3F4F6', padding: '2px 10px',
            borderRadius: 6, letterSpacing: 2,
          }}>
            {labelFromBoxes}
          </div>
        )}
      </div>
    </div>
  );
}
