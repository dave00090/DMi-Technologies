import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RefreshCw, Barcode, Check, Keyboard, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { playScanBeep } from '../lib/barcodeUtils';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, isOpen }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [activeTab, setActiveTab] = useState<'MANUAL' | 'CAMERA'>('MANUAL');
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastScannedRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);

  // Auto-focus input field on mount or tab change
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab]);

  // Camera Scanner Lifecycle
  useEffect(() => {
    if (isOpen && activeTab === 'CAMERA') {
      try {
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
            const now = Date.now();
            if (decodedText === lastScannedRef.current && now - lastScanTimeRef.current < 1500) {
              return;
            }
            lastScannedRef.current = decodedText;
            lastScanTimeRef.current = now;

            playScanBeep();
            onScan(decodedText);
            onClose();
          },
          (errorMessage) => {
            // Silently ignore camera frame errors
          }
        );

        scannerRef.current = scanner;
      } catch (err: any) {
        console.error("Camera init failed:", err);
        setError("Camera unavailable or permission denied. Please use Hardware Gun / Manual Entry.");
      }

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear().catch(error => {
            console.error("Failed to clear scanner", error);
          });
          scannerRef.current = null;
        }
      };
    }
  }, [isOpen, activeTab, onScan, onClose]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (code) {
      playScanBeep();
      onScan(code);
      setManualCode('');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="bg-card border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-bg">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                  <Barcode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-ink">Barcode Scanner Engine</h3>
                  <p className="text-[11px] font-bold text-muted">Desktop Hardware Gun & Camera Compatible</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-muted rounded-xl text-muted hover:text-ink transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Selector Tabs */}
            <div className="px-4 pt-3 bg-bg border-b border-border flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('MANUAL')}
                className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 border ${
                  activeTab === 'MANUAL'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                    : 'bg-card text-muted border-border hover:bg-muted/50'
                }`}
              >
                <Keyboard className="w-4 h-4" />
                <span>Hardware Gun / Manual</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('CAMERA')}
                className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 border ${
                  activeTab === 'CAMERA'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                    : 'bg-card text-muted border-border hover:bg-muted/50'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Webcam Feed</span>
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {activeTab === 'MANUAL' ? (
                /* Hardware Gun & Manual Keyboard Mode */
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl">
                    <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <Barcode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Ready for Hardware USB Laser Scanners
                    </p>
                    <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">
                      Point your handheld USB/Bluetooth scanner gun at any product barcode or type manually below.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted uppercase tracking-wider block">
                      Manual Barcode / Hardware Gun Entry
                    </label>
                    <div className="relative">
                      <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500" />
                      <input
                        ref={inputRef}
                        type="text"
                        placeholder="Type or scan barcode..."
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        autoFocus
                        className="w-full pl-11 pr-4 py-3 bg-bg border-2 border-indigo-500/40 rounded-2xl text-ink text-base font-mono font-bold outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={!manualCode.trim()}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Apply</span>
                    </button>
                    {manualCode && (
                      <button
                        type="button"
                        onClick={() => setManualCode('')}
                        className="px-4 py-3 bg-bg hover:bg-muted text-muted font-bold text-xs rounded-2xl border border-border"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                /* Camera Mode */
                <div className="space-y-3">
                  <div id="reader" className="overflow-hidden rounded-2xl border border-border bg-black aspect-square"></div>
                  
                  {error && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-xs font-bold text-center flex flex-col items-center gap-2">
                      <ShieldAlert className="w-6 h-6" />
                      <span>{error}</span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('MANUAL')}
                        className="px-3 py-1.5 bg-rose-600 text-white text-[11px] font-black uppercase rounded-xl"
                      >
                        Switch to Hardware Gun / Manual
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-center pt-2 border-t border-border/60">
                <div className="p-2.5 bg-bg border border-border rounded-xl">
                  <p className="text-[9px] font-black text-muted uppercase">Supported Formats</p>
                  <p className="text-xs font-bold text-ink">EAN-13, UPC, Code-128</p>
                </div>
                <div className="p-2.5 bg-bg border border-border rounded-xl">
                  <p className="text-[9px] font-black text-muted uppercase">Scanner Status</p>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    System Active
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-bg border-t border-border text-center">
              <p className="text-[11px] text-muted font-bold">
                Hardware USB scanners type directly into the input field or anywhere in POS.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
