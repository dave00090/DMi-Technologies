/**
 * Resolves the active Backend API Base URL for M-Pesa STK push,
 * SMS notifications, guest desk requests, and cloud server calls.
 * 
 * Works seamlessly across:
 * 1. Tauri compiled .exe (routes requests to deployed cloud backend, e.g. Render / Cloud Run)
 * 2. Hosted web app (uses window.location.origin)
 * 3. Custom backend URL override saved in localStorage
 */

export const DEFAULT_PRODUCTION_BACKEND_URL = 'https://dmi-technologies.onrender.com';

export function getApiBaseUrl(): string {
  // 1. Check user-defined backend URL in LocalStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    const savedUrl = localStorage.getItem('dmi_pos_backend_url');
    if (savedUrl && savedUrl.trim()) {
      return savedUrl.trim().replace(/\/+$/, '');
    }
  }

  // 2. Check environment variable VITE_BACKEND_URL
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl && envUrl.trim() && !envUrl.includes('YOUR_')) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 3. Check window location origin
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    const isTauriOrFile = 
      origin.startsWith('tauri://') || 
      origin.includes('tauri.localhost') || 
      origin.startsWith('file://') ||
      !!(window as any).__TAURI__ ||
      !!(window as any).__TAURI_INTERNALS__;

    // If running in Tauri .exe or standalone desktop shell, route to production backend URL
    if (isTauriOrFile) {
      return DEFAULT_PRODUCTION_BACKEND_URL;
    }

    // In web browser mode, use window.location.origin unless running on local static preview without backend
    if (origin && !origin.includes('localhost:3000')) {
      return origin.replace(/\/+$/, '');
    }
  }

  // Fallback to default production backend URL
  return DEFAULT_PRODUCTION_BACKEND_URL;
}

export function setApiBaseUrl(url: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (!url || !url.trim()) {
      localStorage.removeItem('dmi_pos_backend_url');
    } else {
      localStorage.setItem('dmi_pos_backend_url', url.trim().replace(/\/+$/, ''));
    }
  }
}
