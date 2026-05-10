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
    const { phoneNumber, amount, config } = req.body;
    const { consumerKey, consumerSecret, passkey, shortCode } = config;

    if (!consumerKey || !consumerSecret || !passkey || !shortCode) {
      return res.status(400).json({ error: 'Missing M-Pesa credentials' });
    }

    try {
      // 1. Get Access Token
      const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
      const authResponse = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
        headers: { Authorization: `Basic ${auth}` }
      });
      const accessToken = authResponse.data.access_token;

      // 2. Generate Password
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

      // 3. Initiate STK Push
      const stkResponse = await axios.post('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: phoneNumber.replace('+', ''),
        PartyB: shortCode,
        PhoneNumber: phoneNumber.replace('+', ''),
        CallBackURL: `${req.protocol}://${req.get('host')}/api/mpesa/callback`,
        AccountReference: 'DMiTechnologies',
        TransactionDesc: 'Payment for goods'
      }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const checkoutRequestID = stkResponse.data.CheckoutRequestID;
      pendingTransactions.set(checkoutRequestID, { status: 'PENDING', timestamp: Date.now() });

      res.json(stkResponse.data);
    } catch (error: any) {
      console.error('STK Push Error:', error.response?.data || error.message);
      res.status(500).json({ error: error.response?.data || 'Failed to initiate STK push' });
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

  app.get('/api/my-ip', (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    res.json({ ip: Array.isArray(ip) ? ip[0] : ip });
  });

  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`PORT: ${PORT}`);

  // Vite middleware for development
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(distPath);

  if (!isProd || !hasDist) {
    console.log('Starting in DEVELOPMENT mode (using Vite middleware)');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Starting in PRODUCTION mode (serving from dist)');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
