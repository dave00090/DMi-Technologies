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
  
  // Set styles to keep it offscreen but with proper layout boundaries for the browser print engine
  Object.assign(iframe.style, {
    position: 'absolute',
    left: '-9999px',
    top: '-9999px',
    width: '450px',
    height: '800px',
    border: '0',
    zIndex: '-9999',
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
      
      @media print {
        /* Bulletproof visibility forcing: prevents any legacy print-hiding classes in cloned parent styles from hiding the iframe contents */
        html, body, body.printing-receipt, body.printing-report, .printing-receipt, .printing-report {
          visibility: visible !important;
          display: block !important;
          opacity: 1 !important;
          background: white !important;
          color: black !important;
          margin: 0 !important;
          padding: ${isReceipt ? '0' : '10px'} !important;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        /* Ensure everything inside the print iframe is visible by default to override global parent document overrides */
        body, body *, html *, body.printing-receipt *, body.printing-report * {
          visibility: visible !important;
          opacity: 1 !important;
        }

        /* Target the specific printed element directly to guarantee visibility */
        #${elementId}, #${elementId} * {
          visibility: visible !important;
          opacity: 1 !important;
        }
  
        /* Explicitly hide non-printable UI elements */
        .print\\:hidden, aside, header, nav, button, .no-print, [role="button"], .no-print *, .print\\:hidden * {
          display: none !important;
          visibility: hidden !important;
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
        `}
      }

      /* Basic styling for non-printing context (if viewed inside browser tab directly) */
      html, body {
        background: white;
        color: black;
      }
    </style>
  `);

  // Write corresponding printing classes to the iframe body
  iframeDoc.write(`</head><body class="${isReceipt ? 'printing-receipt' : 'printing-report'}">`);
  
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
