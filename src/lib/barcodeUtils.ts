/**
 * Utility functions for Universal Barcode Generation, Validation, and Audio Feedback
 * Works seamlessly across web, desktop (.exe Electron/Tauri) and handheld Android POS devices.
 */

// Play a high-pitched pleasant POS scanner beep (works 100% offline)
export const playScanBeep = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, ctx.currentTime); // 1800 Hz scan pitch
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08); // 80ms duration

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (err) {
    // Web Audio may be restricted before user gesture; fail silently
  }
};

/**
 * Calculate standard GS1 EAN-13 Check Digit
 */
export const calculateEAN13CheckDigit = (first12Digits: string): number => {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(first12Digits.charAt(i), 10);
    if (isNaN(digit)) return 0;
    // 1-based index: odd positions weighted 1, even positions weighted 3
    sum += (i % 2 === 0) ? digit : digit * 3;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
};

/**
 * Generate Universal EAN-13 Barcode for internal retail / inventory
 * Uses GS1 in-store prefix "20" - "29"
 */
export const generateEAN13Barcode = (): string => {
  // GS1 Internal Store Prefix "20"
  const prefix = "20";
  // 10 random numeric digits
  let randomDigits = "";
  for (let i = 0; i < 10; i++) {
    randomDigits += Math.floor(Math.random() * 10).toString();
  }
  const first12 = prefix + randomDigits;
  const checkDigit = calculateEAN13CheckDigit(first12);
  return first12 + checkDigit.toString();
};

/**
 * Generate Alphanumeric CODE-128 Barcode
 */
export const generateCode128Barcode = (prefix = "SKU"): string => {
  const randomPart = Math.floor(100000 + Math.random() * 900000).toString();
  return `${prefix}-${randomPart}`;
};

/**
 * Basic Format Validator for Universal Barcodes
 */
export const validateBarcode = (code: string): { isValid: boolean; type: string } => {
  const clean = code.trim();
  if (/^\d{13}$/.test(clean)) {
    const check = calculateEAN13CheckDigit(clean.slice(0, 12));
    const isEAN13 = parseInt(clean.charAt(12), 10) === check;
    return { isValid: isEAN13, type: 'EAN-13' };
  }
  if (/^\d{12}$/.test(clean)) {
    return { isValid: true, type: 'UPC-A' };
  }
  if (/^\d{8}$/.test(clean)) {
    return { isValid: true, type: 'EAN-8' };
  }
  if (/^[A-Za-z0-9\-_]{3,30}$/.test(clean)) {
    return { isValid: true, type: 'CODE-128 / Custom' };
  }
  return { isValid: clean.length >= 3, type: 'General' };
};
