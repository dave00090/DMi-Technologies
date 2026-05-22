import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // M-Pesa Integration Logic
  const pendingTransactions = new Map<string, any>();

  // Cleanup old pending transactions every 10 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [id, tx] of pendingTransactions.entries()) {
      if (now - tx.timestamp > 10 * 60 * 1000) { // 10 minutes
        pendingTransactions.delete(id);
      }
    }
  }, 10 * 60 * 1000);

  app.post('/api/mpesa/stkpush', async (req, res) => {
    console.log('Received STK Push request');
    let { phoneNumber, amount, config } = req.body;
    const { consumerKey, consumerSecret, passkey, shortCode, environment = 'sandbox' } = config;

    if (!consumerKey || !consumerSecret || !passkey || !shortCode) {
      console.error('Missing credentials in request');
      return res.status(400).json({ error: 'Missing M-Pesa credentials' });
    }

    const baseUrl = environment === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';

    // Format phone number: ensure 254... format
    phoneNumber = phoneNumber.replace(/\+/g, '').replace(/\s/g, '');
    if (phoneNumber.startsWith('0')) {
      phoneNumber = '254' + phoneNumber.slice(1);
    } else if (phoneNumber.startsWith('7') || phoneNumber.startsWith('1')) {
      phoneNumber = '254' + phoneNumber;
    }

    if (!/^254[17][0-9]{8}$/.test(phoneNumber)) {
      return res.status(400).json({ error: 'Invalid phone number. Must be in format 2547XXXXXXXX or 07XXXXXXXX' });
    }

    try {
      console.log(`Fetching Access Token from ${baseUrl}...`);
      // 1. Get Access Token
      const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
      const authResponse = await axios.get(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${auth}` },
        timeout: 15000 // 15s timeout
      });
      const accessToken = authResponse.data.access_token;
      console.log('Access Token acquired');

      // 2. Generate Password
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

      // 3. Initiate STK Push
      console.log(`Initiating STK Push to ${baseUrl} for ${phoneNumber} amount ${amount}...`);
      
      // Use HTTPS for callback if possible, or a fallback hostname
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      
      // Use manual override if provided, otherwise detect
      const callBackURL = config.callbackUrl || `${protocol}://${host}/api/mpesa/callback`;

      console.log(`Using Callback URL: ${callBackURL}`);

      const stkResponse = await axios.post(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline', 
        Amount: Math.max(1, Math.round(amount)),
        PartyA: phoneNumber,
        PartyB: shortCode,
        PhoneNumber: phoneNumber,
        CallBackURL: callBackURL,
        AccountReference: 'DMiTechnologies',
        TransactionDesc: 'Payment for goods'
      }, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 30000 // 30s timeout
      });

      console.log('STK Push initiated successfully:', stkResponse.data.CheckoutRequestID);
      const checkoutRequestID = stkResponse.data.CheckoutRequestID;
      pendingTransactions.set(checkoutRequestID, { status: 'PENDING', timestamp: Date.now() });

      res.json(stkResponse.data);
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      console.error('STK Push Error Detail:', JSON.stringify(errorData));
      
      let clientErrorMessage = 'Failed to initiate STK push';
      if (error.code === 'ECONNABORTED') {
        clientErrorMessage = 'Request timed out while connecting to Safaricom. Please try again.';
      } else if (error.response) {
        clientErrorMessage = error.response.data?.errorMessage || error.response.data?.ResponseDescription || 'Safaricom API Error';
      }

      res.status(500).json({ error: clientErrorMessage, details: errorData });
    }
  });

  app.post('/api/mpesa/callback', (req, res) => {
    const { Body } = req.body;
    if (!Body || !Body.stkCallback) return res.sendStatus(400);

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = Body.stkCallback;
    
    let mpesaReceiptNumber = '';
    if (CallbackMetadata && CallbackMetadata.Item) {
      const item = CallbackMetadata.Item.find((i: any) => i.Name === 'MpesaReceiptNumber');
      if (item) mpesaReceiptNumber = item.Value;
    }

    pendingTransactions.set(CheckoutRequestID, {
      status: ResultCode === 0 ? 'SUCCESS' : 'FAILED',
      resultDesc: ResultDesc,
      reference: mpesaReceiptNumber,
      timestamp: Date.now()
    });

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  });

  app.get('/api/mpesa/status/:checkoutRequestId', (req, res) => {
    const { checkoutRequestId } = req.params;
    const transaction = pendingTransactions.get(checkoutRequestId);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(transaction);
  });

  app.get('/api/mpesa/test', async (req, res) => {
    const { consumerKey, consumerSecret, environment = 'sandbox' } = req.query;
    
    if (!consumerKey || !consumerSecret) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    const baseUrl = environment === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';

    try {
      const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
      const authResponse = await axios.get(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${auth}` },
        timeout: 10000
      });
      
      res.json({ 
        status: 'SUCCESS', 
        message: 'Successfully authenticated with Safaricom!',
        environment: environment
      });
    } catch (error: any) {
      res.status(500).json({ 
        status: 'FAILED', 
        error: error.response?.data?.errorMessage || error.message,
        details: error.response?.data
      });
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'OK', 
      serverTime: new Date().toISOString(),
      nodeVersion: process.version,
      env: process.env.NODE_ENV || 'development'
    });
  });

  // --- Hybrid Cloud Sync Database Configuration ---
  const DATA_DIR = path.resolve(__dirname, 'data');
  const DB_FILE = path.join(DATA_DIR, 'cloud_db.json');

  // Initialize DB file
  function initCloudDb() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(DB_FILE)) {
        const freshDb = {
          businesses: [],
          shops: [],
          products: [],
          sales: [],
          customers: [],
          expenses: [],
          suppliers: [],
          employees: [],
          attendance: [],
          payroll: [],
          debts: [],
          ledger: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(freshDb, null, 2), 'utf8');
        console.log('Central sync cloud database created at:', DB_FILE);
      }
    } catch (e) {
      console.error('Failed to initialize central cloud database:', e);
    }
  }

  initCloudDb();

  function getCloudDb(): any {
    try {
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(content);
      }
    } catch (err) {
      console.error('Error reading cloud DB, returning empty structure:', err);
    }
    return {
      businesses: [],
      shops: [],
      products: [],
      sales: [],
      customers: [],
      expenses: [],
      suppliers: [],
      employees: [],
      attendance: [],
      payroll: [],
      debts: [],
      ledger: []
    };
  }

  function saveCloudDb(data: any) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('CRITICAL: Failed to write to cloud database:', err);
    }
  }

  // Pull updates from central cloud server
  app.get('/api/sync/pull', (req, res) => {
    const { businessId, shopId, since } = req.query;
    if (!businessId) {
      return res.status(400).json({ error: 'Missing businessId' });
    }

    const db = getCloudDb();
    const result: Record<string, any[]> = {};
    const sinceTime = since ? new Date(since as string).getTime() : 0;

    const filterFn = (items: any[], checkShopId = true) => {
      if (!Array.isArray(items)) return [];
      return items.filter(item => {
        if (!item) return false;
        if (item.businessId !== businessId) return false;
        if (checkShopId && shopId && item.shopId && item.shopId !== shopId) return false;
        
        if (sinceTime > 0) {
          const itemTime = item.lastUpdated ? new Date(item.lastUpdated).getTime() : 0;
          return itemTime > sinceTime;
        }
        return true;
      });
    };

    result.businesses = filterFn(db.businesses, false);
    result.shops = filterFn(db.shops, false);
    result.products = filterFn(db.products, true);
    result.sales = filterFn(db.sales, true);
    result.customers = filterFn(db.customers, false);
    result.expenses = filterFn(db.expenses, true);
    result.suppliers = filterFn(db.suppliers, false);
    result.employees = filterFn(db.employees, true);
    result.attendance = filterFn(db.attendance, false);
    result.payroll = filterFn(db.payroll, false);
    result.debts = filterFn(db.debts, true);
    result.ledger = filterFn(db.ledger, true);

    res.json({
      timestamp: new Date().toISOString(),
      data: result
    });
  });

  // Push local updates to central cloud server
  app.post('/api/sync/push', (req, res) => {
    const { businessId, shopId, changes } = req.body;
    if (!businessId) {
      return res.status(400).json({ error: 'Missing businessId' });
    }

    if (!changes || typeof changes !== 'object') {
      return res.status(400).json({ error: 'Missing sync changes map' });
    }

    const db = getCloudDb();
    const syncedIds: Record<string, string[]> = {};

    const tableKeys = [
      'businesses', 'shops', 'products', 'sales', 'customers',
      'expenses', 'suppliers', 'employees', 'attendance', 'payroll',
      'debts', 'ledger'
    ];

    for (const table of tableKeys) {
      const itemsToPush = changes[table];
      if (!itemsToPush || !Array.isArray(itemsToPush)) {
        syncedIds[table] = [];
        continue;
      }

      syncedIds[table] = [];
      const currentTableList = db[table] || [];

      for (const item of itemsToPush) {
        if (!item) continue;
        const itemId = item.id || item.uid;
        if (!itemId) continue;

        item.lastUpdated = item.lastUpdated || new Date().toISOString();
        item.synced = true;

        const index = currentTableList.findIndex((x: any) => (x.id || x.uid) === itemId);
        
        if (index > -1) {
          const currentItem = currentTableList[index];
          const curTime = currentItem.lastUpdated ? new Date(currentItem.lastUpdated).getTime() : 0;
          const newItemTime = new Date(item.lastUpdated).getTime();

          // Last-Write-Wins rule
          if (newItemTime >= curTime) {
            currentTableList[index] = { ...currentItem, ...item };
          }
        } else {
          currentTableList.push(item);
        }

        // AUTO INVENTORY DEDUCTION ON CLOUD SALES PUSH
        if (table === 'sales') {
          const sale = item;
          if (sale.items && Array.isArray(sale.items)) {
            for (const saleItem of sale.items) {
              const prodIndex = db.products.findIndex((p: any) => p.id === saleItem.productId);
              if (prodIndex > -1) {
                const product = db.products[prodIndex];
                if (product.variants && Array.isArray(product.variants)) {
                  const varIndex = product.variants.findIndex((v: any) => v.id === saleItem.variantId);
                  if (varIndex > -1) {
                    product.variants[varIndex].stock = Math.max(0, product.variants[varIndex].stock - saleItem.quantity);
                    product.lastUpdated = new Date().toISOString();
                    console.log(`Cloud sync inventory update: product ${product.name} Variant ${saleItem.variantName} stock reduced by ${saleItem.quantity}`);
                  }
                }
              }
            }
          }
        }

        syncedIds[table].push(itemId);
      }

      db[table] = currentTableList;
    }

    saveCloudDb(db);

    res.json({
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
      syncedIds
    });
  });

  app.get('/api/my-ip', (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    res.json({ ip: Array.isArray(ip) ? ip[0] : ip });
  });

  // Specific 404 for API routes
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`PORT: ${PORT}`);

  // Vite middleware for development
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(__dirname, 'dist');
  const hasDist = fs.existsSync(distPath);

  if (!isProd || !hasDist) {
    console.log(`Starting in DEVELOPMENT mode (hasDist: ${hasDist})`);
    try {
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          watch: null, // Disable file watching to prevent hangs in some environments
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('Vite middleware initialized');
    } catch (vErr) {
      console.error('FAILED to initialize Vite server:', vErr);
    }
  } else {
    console.log('Starting in PRODUCTION mode (serving from dist)');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
    } else {
      console.error('Server error:', e);
    }
  });
}

startServer().catch(err => {
  console.error("CRITICAL: Failed to start server:", err);
  process.exit(1);
});
