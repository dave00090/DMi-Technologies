
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const isDev = !app.isPackaged;

function createWindow() {
  console.log('App starting. Dev mode:', isDev);
  
  const iconPath = path.join(__dirname, 'public/app-icon.png');
  
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: '#0f172a',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: false
    },
  });

  // Remove default menu for cleaner POS look
  Menu.setApplicationMenu(null);

  win.once('ready-to-show', () => {
    win.show();
    console.log('Window ready to show. Path loaded:', win.webContents.getURL());
  });

  if (isDev && !process.env.FORCE_PROD) {
    win.loadURL('http://localhost:3000').catch((e) => {
      console.error('Failed to load local dev server:', e);
      const indexPath = path.join(__dirname, 'dist', 'index.html');
      if (fs.existsSync(indexPath)) {
        win.loadFile(indexPath).catch(err => {
           showErrorPage(win, 'File Load Error', `Failed to load ${indexPath}: ${err.message}`);
        });
      }
    });
    win.webContents.openDevTools();
  } else {
    // Production path
    // Use app.getAppPath() to be sure
    const appPath = app.isPackaged ? path.dirname(app.getPath('exe')) : __dirname;
    // Actually, in asar, __dirname is the root of the asar.
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    console.log('Production mode. Index path:', indexPath);
    
    if (fs.existsSync(indexPath)) {
      win.loadFile(indexPath).catch((e) => {
        console.error('Failed to load production index.html:', e);
        showErrorPage(win, 'System Error', `Failed to load application interface.<br>Please try to reinstall the application.<br><br>Error: ${e.message}`);
      });
    } else {
      console.error('CRITICAL: dist/index.html not found even in production mode at:', indexPath);
      showErrorPage(win, 'Installation Incomplete', `The <b>dist</b> folder is missing or incomplete at:<br><code>${indexPath}</code><br><br>Please contact support or reinstall.`);
    }
  }

  // Handle errors that cause white screens
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Page failed to load:', errorCode, errorDescription, validatedURL);
    if (validatedURL.includes('index.html')) {
        showErrorPage(win, 'Page Load Error', `Failed to load: ${errorDescription} (${errorCode})`);
    }
  });

  win.webContents.on('crashed', () => {
    console.error('The renderer process crashed');
    showErrorPage(win, 'System Crash', 'The application process crashed unexpectedly. Please restart.');
  });
}

function showErrorPage(win, title, message) {
  const html = `<html><body style="background:#0f172a;color:white;font-family:sans-serif;padding:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;">
    <div style="background:#1e293b;padding:40px;border-radius:24px;border:1px solid #334155;max-width:600px;box-shadow:0 20px 50px rgba(0,0,0,0.3)">
      <h1 style="color:#6366f1;font-size:32px;margin:0 0 20px 0">${title}</h1>
      <div style="color:#94a3b8;font-size:16px;line-height:1.6;margin-bottom:30px">${message}</div>
      <button onclick="location.reload()" style="background:#6366f1;color:white;border:none;padding:12px 30px;border-radius:12px;font-weight:bold;cursor:pointer;font-size:16px;transition:all 0.2s" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Retry Launch</button>
    </div>
  </body></html>`;
  win.loadURL(`data:text/html,${encodeURIComponent(html)}`);
  win.show();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
