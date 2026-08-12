import { useEffect, useRef } from 'react';
import { playScanBeep } from '../lib/barcodeUtils';

interface UseHardwareScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  soundFeedback?: boolean;
}

export const useHardwareScanner = ({ 
  onScan, 
  enabled = true,
  soundFeedback = true 
}: UseHardwareScannerOptions) => {
  const bufferRef = useRef<string>('');
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      // Ignore modifier keys
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(event.key) && event.key !== 'Tab') {
        return;
      }

      // Hardware scanners typically transmit characters very rapidly (< 50ms interval)
      // Reset buffer if time between keystrokes exceeds 120ms
      if (timeDiff > 120 && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      // Scanners typically send 'Enter' or 'Tab' at the end of the scan string
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (bufferRef.current.length >= 3) {
          const scannedCode = bufferRef.current.trim();
          bufferRef.current = '';
          
          if (soundFeedback) {
            playScanBeep();
          }

          onScan(scannedCode);
          event.preventDefault();
          event.stopPropagation();
        }
      } else if (event.key.length === 1) {
        bufferRef.current += event.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onScan, enabled, soundFeedback]);
};

