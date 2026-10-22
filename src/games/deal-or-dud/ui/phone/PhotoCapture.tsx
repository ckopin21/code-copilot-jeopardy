// Selfie capture without a secure context: the file input with capture="user" opens the phone's own camera app
// (works over plain http on a LAN), then this screen lets the player drag/zoom to crop, retake, or cancel.
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';

const OUTPUT = 192;
const VIEW = 260;

export function PhotoCapture({ file, onUse, onCancel }: { file: File; onUse: (dataUrl: string) => void; onCancel: () => void }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState('');
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const onFile = (picked: File | undefined) => {
    if (!picked) return;
    setError('');
    const url = URL.createObjectURL(picked);
    const next = new Image();
    next.onload = () => { setImage(next); setZoom(1); setOffset({ x: 0, y: 0 }); };
    next.onerror = () => setError('That photo could not be opened. Try again or pick a character.');
    next.src = url;
  };
  useEffect(() => { onFile(file); }, [file]);

  // Base scale makes the shorter side fill the crop circle.
  const base = image ? VIEW / Math.min(image.naturalWidth, image.naturalHeight) : 1;
  const scale = base * zoom;
  const clampOffset = (x: number, y: number) => {
    if (!image) return { x, y };
    const maxX = Math.max(0, (image.naturalWidth * scale - VIEW) / 2);
    const maxY = Math.max(0, (image.naturalHeight * scale - VIEW) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };
  const onDown = (event: PointerEvent) => { (event.target as Element).setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }; };
  const onMove = (event: PointerEvent) => { if (drag.current) setOffset(clampOffset(drag.current.ox + event.clientX - drag.current.x, drag.current.oy + event.clientY - drag.current.y)); };
  const onUp = () => { drag.current = null; };

  const use = () => {
    if (!image) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT; canvas.height = OUTPUT;
    const context = canvas.getContext('2d');
    if (!context) { setError('This phone could not process the photo.'); return; }
    const ratio = OUTPUT / VIEW;
    const width = image.naturalWidth * scale * ratio;
    const height = image.naturalHeight * scale * ratio;
    context.drawImage(image, (OUTPUT - width) / 2 + offset.x * ratio, (OUTPUT - height) / 2 + offset.y * ratio, width, height);
    onUse(canvas.toDataURL('image/jpeg', 0.82));
  };

  return <div className="dod-photo">
    {image ? <>
      <p>Drag to center your face. Pinch the slider to zoom.</p>
      <div className="dod-crop" style={{ width: VIEW, height: VIEW }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <img src={image.src} alt="Your photo" draggable={false} style={{ width: image.naturalWidth * scale, height: image.naturalHeight * scale, transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }}/>
      </div>
      <label className="dod-zoom">Zoom <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(event) => { setZoom(Number(event.target.value)); setOffset((current) => clampOffset(current.x, current.y)); }}/></label>
      <div className="dod-row"><CameraButton className="dod-ghost" onFile={onFile}>Retake</CameraButton><button className="dod-primary" onClick={use}>Use this photo</button></div>
    </> : <>
      <p>Loading your photo…</p>
      <CameraButton className="dod-primary" onFile={onFile}>📷 Try again</CameraButton>
    </>}
    {error && <p className="dod-error">{error}</p>}
    <button className="dod-link" onClick={onCancel}>Pick a character instead</button>
  </div>;
}

/** A label around a hidden file input, so the tap itself opens the camera (required on iPhone). */
export function CameraButton({ onFile, className, children }: { onFile: (file: File | undefined) => void; className?: string; children: ReactNode }) {
  return <label className={`dod-camera-button ${className ?? ''}`} role="button" tabIndex={0}>
    <input type="file" accept="image/*" capture="user" onChange={(event) => { onFile(event.target.files?.[0]); event.target.value = ''; }}/>
    {children}
  </label>;
}
