import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, isOpen }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.0,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE
          ]
        },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText) => {
          onScan(decodedText);
          // We don't close automatically to allow multiple scans
        },
        (errorMessage) => {
          // Silently ignore scan errors (they happen constantly when no barcode is in view)
        }
      );

      scannerRef.current = scanner;

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear().catch(error => {
            console.error("Failed to clear scanner", error);
          });
        }
      };
    }
  }, [isOpen, onScan]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-card border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-border flex items-center justify-between bg-bg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-xl">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-ink">Barcode Scanner</h3>
                  <p className="text-xs text-muted">Align barcode within the frame</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-muted rounded-xl text-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div id="reader" className="overflow-hidden rounded-2xl border border-border bg-black aspect-square"></div>
              
              {error && (
                <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-medium text-center">
                  {error}
                </div>
              )}

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-muted uppercase mb-1">Supported</p>
                  <p className="text-xs font-bold text-ink">EAN, UPC, Code 128</p>
                </div>
                <div className="p-3 bg-muted rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-muted uppercase mb-1">Status</p>
                  <p className="text-xs font-bold text-emerald-500 flex items-center justify-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Active
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-muted/50 border-t border-border">
              <p className="text-[10px] text-center text-muted font-medium">
                Ensure good lighting and hold the device steady.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
