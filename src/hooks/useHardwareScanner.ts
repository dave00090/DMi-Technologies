import { useEffect, useRef } from 'react';

interface UseHardwareScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
}

export const useHardwareScanner = ({ onScan, enabled = true }: UseHardwareScannerOptions) => {
  const bufferRef = useRef<string>('');
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      // Ignore modifiers
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;

      // If time between keys is too long, reset buffer (unless it's the first key)
      // Hardware scanners are usually very fast (< 30ms between keys)
      // Human typing is usually > 50ms. Using 100ms as a safe threshold for slow scanners.
      if (timeDiff > 100 && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      if (event.key === 'Enter') {
        if (bufferRef.current.length >= 3) {
          onScan(bufferRef.current);
          bufferRef.current = '';
          event.preventDefault();
        }
      } else if (event.key.length === 1) {
        bufferRef.current += event.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onScan, enabled]);
};
