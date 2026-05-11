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
