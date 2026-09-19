import { useEffect, useRef, useState } from 'react';
import { useOutsideDismiss } from '../lib/useOutsideDismiss';

type BarcodeResult = { rawValue?: string };
type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<BarcodeResult[]> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function detectorConstructor(): BarcodeDetectorConstructor | null {
  return ((window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector) ?? null;
}

export function QrScanner({ onResult, onClose }: { onResult: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);

  useOutsideDismiss(true, onClose, cardRef);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    let lastScan = 0;

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };

    const start = async () => {
      if (!window.isSecureContext) {
        setStarting(false);
        setError('Camera scanning requires HTTPS on this browser. Enter the room code manually.');
        return;
      }
      const Detector = detectorConstructor();
      if (!Detector) {
        setStarting(false);
        setError('QR camera scanning is not supported by this browser. Enter the room code manually.');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStarting(false);
        setError('This browser cannot open the camera. Enter the room code manually.');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (cancelled) { stop(); return; }
        const video = videoRef.current;
        if (!video) { stop(); return; }
        video.srcObject = stream;
        await video.play();
        setStarting(false);
        const detector = new Detector({ formats: ['qr_code'] });

        const scan = async (time: number) => {
          if (cancelled) return;
          if (time - lastScan > 180 && video.readyState >= 2) {
            lastScan = time;
            try {
              const results = await detector.detect(video);
              const value = results.find((item) => item.rawValue)?.rawValue?.trim();
              if (value) {
                stop();
                onResult(value);
                return;
              }
            } catch { /* keep scanning while the camera is active */ }
          }
          frame = requestAnimationFrame(scan);
        };
        frame = requestAnimationFrame(scan);
      } catch (err) {
        setStarting(false);
        setError(err instanceof Error && err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access or enter the room code manually.'
          : 'Could not open the camera. Enter the room code manually.');
      }
    };

    void start();
    return () => { cancelled = true; stop(); };
  }, [onResult]);

  return <div className="qr-scanner-backdrop" role="dialog" aria-modal="true" aria-label="Scan game QR code">
    <section ref={cardRef} className="qr-scanner-card">
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close camera">×</button>
      <div className="section-kicker">SCAN JOIN QR</div>
      <h2>Point your camera at the host QR code</h2>
      <div className="qr-camera-frame">
        <video ref={videoRef} muted playsInline />
        <span className="qr-corner top-left"/><span className="qr-corner top-right"/><span className="qr-corner bottom-left"/><span className="qr-corner bottom-right"/>
        {starting && <div className="qr-camera-status">Opening camera…</div>}
      </div>
      {error && <p className="form-error">{error}</p>}
      <button type="button" className="secondary-button" onClick={onClose}>Enter code instead</button>
    </section>
  </div>;
}
