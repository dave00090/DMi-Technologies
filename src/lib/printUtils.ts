/**
 * Utility for robust, cross-platform element printing.
 * Works seamlessly in standard browsers, sandboxed iframes, and Electron.
 * 
 * Instead of modifying body classes of the main window (which can be unreliable due to
 * asynchronous/non-blocking window.print implementation in Electron, leading to blank prints),
 * this utility renders the target element inside a temporary hidden iframe and prints that context.
 */
export const printElement = (elementId: string, isReceipt = true): boolean => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`[Print] Element with id "${elementId}" not found.`);
    return false;
  }

  // Clear any existing temporary print iframe
  const oldIframe = document.getElementById('print-iframe-temp');
  if (oldIframe) {
    oldIframe.remove();
  }

  // Create temporary hidden iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'print-iframe-temp';
  
  // Set styles to keep it invisible but present in layout
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    zIndex: '-9999',
    opacity: '0',
    pointerEvents: 'none'
  });

  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!iframeDoc) {
    console.error('[Print] Could not acquire iframe document handle.');
    return false;
  }

  // Open and construct print document
  iframeDoc.open();
  iframeDoc.write('<!DOCTYPE html><html><head><title>Print Layout</title>');

  // 1. Copy all styling sheets from the parent document
  const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
  styles.forEach((style) => {
    iframeDoc.write(style.outerHTML);
  });

  // 2. Inject specialized base overrides for print media
  iframeDoc.write(`
    <style>
      /* Ensure clean print output across standard paper and thermal rollers */
      @page {
        margin: ${isReceipt ? '0' : '15mm'} !important;
      }
      body {
        margin: 0 !important;
        padding: ${isReceipt ? '0' : '10px'} !important;
        background: white !important;
        color: black !important;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      /* Receipt Mode: enforce structured receipt centering and limits */
      ${isReceipt ? `
      #print-receipt, .receipt-font, .receipt-font * {
        font-family: inherit !important;
      }
      #print-receipt {
        display: block !important;
        visibility: visible !important;
        width: 100% !important;
        max-width: 400px !important;
        margin: 0 auto !important;
        box-shadow: none !important;
        border: none !important;
        animation: none !important;
        transition: none !important;
        transform: none !important;
      }
      ` : `
      /* Report mode overrides: ensure everything is visible, table layout is pristine */
      * {
        visibility: visible !important;
      }
      .print\\:hidden, aside, header, nav, button, .no-print, [role="button"] {
        display: none !important;
        visibility: hidden !important;
      }
      `}
    </style>
  `);

  iframeDoc.write('</head><body>');
  
  // 3. Render the target layout wrapper and outerHTML
  iframeDoc.write(`<div class="${isReceipt ? '' : 'w-full'}" style="width: 100%; box-sizing: border-box;">${element.outerHTML}</div>`);
  iframeDoc.write('</body></html>');
  iframeDoc.close();

  // 4. Print after rendering structure and stylesheets compile
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('[Print] Execution failed:', err);
    }

    // Retain iframe for 15s to let backgrounds spool completely, then clean up safely.
    setTimeout(() => {
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 15000);
  }, 350);

  return true;
};
