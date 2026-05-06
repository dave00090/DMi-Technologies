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
      // Ignore events from input fields to prevent interference
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      // If time between keys is too long, reset buffer (unless it's the first key)
      if (timeDiff > 50 && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      if (event.key === 'Enter') {
        if (bufferRef.current.length >= 3) {
          onScan(bufferRef.current);
          bufferRef.current = '';
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
