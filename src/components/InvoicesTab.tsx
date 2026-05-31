import React, { useState, useEffect } from 'react';
import { Sale, BusinessProfile, Shop } from '../types';
import { localDb } from '../services/localDb';
import { printElement } from '../lib/printUtils';
import { 
  FileText, 
  Printer, 
  Download, 
  Search, 
  Calendar, 
  User, 
  CreditCard, 
  ShieldCheck, 
  FileDown, 
  RefreshCw,
  Mail,
  Phone,
  Building
} from 'lucide-react';

interface InvoicesTabProps {
  businessId: string;
  shopId: string;
  businessProfile: BusinessProfile;
  shopName: string;
}

export const InvoicesTab: React.FC<InvoicesTabProps> = ({
  businessId,
  shopId,
  businessProfile,
  shopName
}) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const fetchSales = async () => {
    setLoading(true);
    const data = await localDb.getSales(businessId, shopId);
    const validSales = (data || []).filter(sale => sale && sale.id);
    setSales(validSales);
    setLoading(false);
    if (validSales.length > 0 && !selectedSale) {
      setSelectedSale(validSales[0]);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [businessId, shopId]);

  const filteredSales = sales.filter(sale => {
    if (!sale || !sale.id) return false;
    const saleId = String(sale.id).toLowerCase();
    const customer = String(sale.customerName || '').toLowerCase();
    const cashier = String(sale.cashierName || '').toLowerCase();
    const mpesaRef = String(sale.mpesaReference || '').toLowerCase();
    const search = (searchTerm || '').toLowerCase();

    const matchesSearch = 
      saleId.includes(search) ||
      customer.includes(search) ||
      cashier.includes(search) ||
      mpesaRef.includes(search);

    const matchesStatus = statusFilter === 'ALL' || sale.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handlePrint = (saleId: string) => {
    printElement(`invoice-printable-${saleId}`, false);
  };

  const handleDownloadHTML = (sale: Sale) => {
    const currencySym = businessProfile.currency || 'USD';
    const companyName = businessProfile.name;
    const companyPhone = businessProfile.phone || 'N/A';
    const companyEmail = businessProfile.email || 'N/A';
    const companyAddress = businessProfile.address || 'N/A';

    const itemsRows = sale.items.map(item => `
      <tr class="border-b border-slate-100">
        <td class="py-4 text-sm font-semibold text-slate-900">${item.name} <span class="text-xs font-normal text-slate-500">(${item.variantName || 'Standard'})</span></td>
        <td class="text-center py-4 text-sm text-slate-600">${item.quantity}</td>
        <td class="text-right py-4 text-sm font-mono text-slate-800">${currencySym} ${item.price.toFixed(2)}</td>
        <td class="text-right py-4 text-sm font-semibold font-mono text-slate-900">${currencySym} ${(item.quantity * item.price).toFixed(2)}</td>
      </tr>
    `).join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Invoice - ${sale.id}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    @media print {
      body { background-color: #ffffff; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 antialiased min-h-screen">
  <div class="max-w-4xl mx-auto p-4 md:p-8 no-print">
    <div class="flex items-center justify-between mb-8 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <span class="text-xs text-slate-500 font-bold uppercase tracking-wider">OFFLINE STANDALONE INVOICE VIEW</span>
      <button onclick="window.print()" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2">
        Print / Save as PDF
      </button>
    </div>
  </div>

  <div class="max-w-4xl mx-auto bg-white p-8 md:p-12 md:rounded-3xl md:border md:border-slate-100 md:shadow-xl">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between lg:items-start gap-8 border-b border-slate-100 pb-10">
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight text-indigo-600 uppercase mb-2">${companyName}</h1>
        <p class="text-sm font-semibold text-slate-500 mb-4">${shopName}</p>
        <div class="text-xs text-slate-600 space-y-1">
          <p class="flex items-center gap-1">📍 ${companyAddress}</p>
          <p class="flex items-center gap-1">📞 ${companyPhone}</p>
          <p class="flex items-center gap-1">✉️ ${companyEmail}</p>
        </div>
      </div>
      <div class="md:text-right">
        <div class="inline-block px-4 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black tracking-widest rounded-full uppercase mb-4">
          TAX INVOICE
        </div>
        <p class="text-xs font-semibold text-slate-500 uppercase mb-1">Invoice ID</p>
        <p class="text-lg font-mono font-bold text-slate-900 mb-3">${sale.id}</p>
        <p class="text-xs font-semibold text-slate-500 uppercase mb-1">Date Created</p>
        <p class="text-sm text-slate-800">${new Date(sale.timestamp).toLocaleString()}</p>
      </div>
    </div>

    <!-- Info Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 py-10 border-b border-slate-100">
      <div>
        <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Bill To</p>
        <p class="text-base font-bold text-slate-900 mb-1">${sale.customerName || 'Walk-in Customer'}</p>
        <p class="text-sm text-slate-500">Terminal Checkout Guest</p>
      </div>
      <div class="md:text-right">
        <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Payment Info</p>
        <p class="text-sm font-bold text-slate-900 mb-1">Method: ${sale.paymentMethod}</p>
        <p class="text-sm text-slate-600">Status: <span class="font-bold text-emerald-600">${sale.status}</span></p>
        ${sale.mpesaReference ? `<p class="text-xs font-mono text-indigo-500 mt-1">Ref: ${sale.mpesaReference}</p>` : ''}
        ${sale.etimsControlNumber ? `<p class="text-[10px] font-mono text-slate-500 mt-1">eTIMS: ${sale.etimsControlNumber}</p>` : ''}
      </div>
    </div>

    <!-- Items Table -->
    <table class="w-full text-left my-8 border-collapse">
      <thead>
        <tr class="border-b border-slate-200 text-xs font-black text-slate-400 uppercase tracking-wider">
          <th class="pb-4">Product or Service Description</th>
          <th class="pb-4 text-center">Qty</th>
          <th class="pb-4 text-right">Unit Price</th>
          <th class="pb-4 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Totals Page -->
    <div class="flex flex-col md:flex-row justify-between items-start gap-8 pt-6">
      <div class="max-w-xs text-xs text-slate-400 leading-relaxed md:pt-4">
        Thank you for doing business with us! This invoice is synchronized using our offline distributed POS ledger systems.
      </div>
      <div class="w-full md:w-80 space-y-3">
        <div class="flex justify-between text-sm text-slate-600">
          <span>Subtotal</span>
          <span class="font-mono">${currencySym} ${(sale.total - (sale.taxAmount || 0)).toFixed(2)}</span>
        </div>
        ${sale.taxRate ? `
        <div class="flex justify-between text-sm text-slate-600">
          <span>VAT (${sale.taxRate}%)</span>
          <span class="font-mono">${currencySym} ${(sale.taxAmount || 0).toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="h-px bg-slate-100 w-full" />
        <div class="flex justify-between items-baseline">
          <span class="text-base font-bold text-slate-900">Total Charged</span>
          <span class="text-2xl font-black font-mono text-indigo-600">${currencySym} ${sale.total.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div class="border-t border-slate-100 mt-12 pt-8 text-center text-xs text-slate-400 font-medium">
      System Generated. Secured by Distributed POS.
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `Invoice_${sale.id}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currencySym = businessProfile.currency || 'USD';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" id="invoices-tab-root">
      {/* Tab Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-6 rounded-3xl shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-ink flex items-center gap-3">
            <FileText className="w-7 h-7 text-indigo-600" />
            Invoices Manager
          </h2>
          <p className="text-sm text-muted mt-1">
            Browse, view, download, and print official VAT tax invoices for past checkout transactions.
          </p>
        </div>
         <button 
          onClick={fetchSales}
          disabled={loading}
          className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-ink dark:text-white backdrop-blur-sm rounded-xl text-sm font-bold flex items-center gap-2 transition-all self-start md:self-auto active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Records
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left pane: Invoices List */}
        <div className="lg:col-span-5 bg-card border border-border rounded-3xl shadow-sm flex flex-col h-[calc(100vh-270px)] min-h-[500px]">
          {/* Controls */}
          <div className="p-4 border-b border-border space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="Search Invoice ID, customer, reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-ink"
              />
            </div>
            
            <div className="flex gap-2">
              {['ALL', 'COMPLETED', 'PENDING_PAYMENT', 'CANCELLED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all ${
                    statusFilter === status 
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/10' 
                      : 'bg-bg text-muted hover:text-ink hover:bg-neutral-100'
                  }`}
                >
                  {status === 'ALL' ? 'All' : status.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* List area */}
          <div className="flex-1 overflow-y-auto divide-y divide-border p-2 space-y-1">
            {loading ? (
              <div className="p-12 text-center text-muted text-sm flex flex-col items-center gap-2">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                <span>Loading invoices history...</span>
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="p-12 text-center text-muted text-sm">
                No matching invoices found in local storage.
              </div>
            ) : (
              filteredSales.map((sale) => (
                <div
                  key={sale.id}
                  onClick={() => setSelectedSale(sale)}
                  className={`w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer flex justify-between items-center ${
                    selectedSale?.id === sale.id 
                      ? 'bg-indigo-50 border-indigo-200 text-gray-900 border' 
                      : 'hover:bg-bg border border-transparent'
                  }`}
                >
                  <div className="space-y-1">
                    <p className="font-mono text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      INV-{sale.id.slice(0, 8).toUpperCase()}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{new Date(sale.timestamp).toLocaleDateString()}</span>
                      <span>•</span>
                      <span className="truncate max-w-[120px]">{sale.customerName || 'Walk-in'}</span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1.5">
                    <span className="font-bold text-slate-900 font-mono text-sm">
                      {currencySym} {sale.total.toFixed(2)}
                    </span>
                    <span className={`px-2 py-0.5 text-[9px] font-extrabold tracking-wider rounded uppercase ${
                      sale.status === 'COMPLETED' 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                        : sale.status === 'PENDING_PAYMENT' 
                        ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                        : 'bg-neutral-50 text-neutral-500 border border-neutral-200'
                    }`}>
                      {sale.status === 'PENDING_PAYMENT' ? 'Pending' : String(sale.status || '').toLowerCase()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right pane: Invoice A4 Preview and Actions */}
        <div className="lg:col-span-7 space-y-6">
          {selectedSale ? (
            <>
              {/* Commands toolbar */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handlePrint(selectedSale.id)}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-500/15 active:scale-[0.98] transition-all"
                >
                  <Printer className="w-4 h-4" />
                  Print / Save as PDF
                </button>
                <button
                  onClick={() => handleDownloadHTML(selectedSale)}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-800 hover:bg-neutral-900 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-white rounded-2xl text-sm font-bold active:scale-[0.98] transition-all"
                >
                  <Download className="w-4 h-4" />
                  Download HTML Invoice
                </button>
              </div>

              {/* Invoice Sheet View Container */}
              <div 
                className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl max-w-2xl mx-auto printing-report text-slate-900" 
                id={`invoice-printable-${selectedSale.id}`}
              >
                {/* Branding Block */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-start pb-6 border-b border-dashed border-slate-200 gap-4">
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-indigo-600 uppercase tracking-tight">
                      {businessProfile.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-bold uppercase">{shopName}</p>
                    <div className="text-[11px] text-slate-600 space-y-0.5">
                      <p className="flex items-center gap-1">📍 {businessProfile.address || 'Standard Address'}</p>
                      <p className="flex items-center gap-1">📞 {businessProfile.phone || 'Standard Contact'}</p>
                      <p className="flex items-center gap-1">✉️ {businessProfile.email || 'Business Email'}</p>
                    </div>
                  </div>
                  <div className="sm:text-right space-y-1">
                    <span className="inline-block px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black rounded-lg uppercase tracking-wider">
                      Tax Invoice
                    </span>
                    <p className="text-[10px] text-slate-400 font-bold uppercase pt-2">Invoice Number</p>
                    <p className="font-mono text-xs font-bold text-slate-800">{selectedSale.id}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Date of Issue</p>
                    <p className="text-xs font-semibold text-slate-700">{new Date(selectedSale.timestamp).toLocaleString()}</p>
                  </div>
                </div>

                {/* Billing specs */}
                <div className="grid grid-cols-2 gap-4 py-6 border-b border-slate-100 text-xs">
                  <div>
                    <h5 className="font-bold text-slate-400 uppercase tracking-wider mb-2">Invoice Recipient</h5>
                    <p className="font-bold text-slate-905">{selectedSale.customerName || 'Walk-in customer'}</p>
                    <p className="text-slate-500 mt-0.5 font-medium">Retail Guest Account</p>
                  </div>
                  <div className="text-right">
                    <h5 className="font-bold text-slate-400 uppercase tracking-wider mb-2">Payment Breakdown</h5>
                    <p className="font-bold text-slate-700">Type: {selectedSale.paymentMethod}</p>
                    <p className="font-black text-emerald-600 mt-0.5">Checkout Completed</p>
                    {selectedSale.mpesaReference && (
                      <p className="font-mono text-[10px] text-indigo-500 mt-1">Ref: {selectedSale.mpesaReference}</p>
                    )}
                  </div>
                </div>

                {/* Items Layout */}
                <div className="py-6 space-y-3">
                  <div className="grid grid-cols-12 text-[10px] font-black text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100">
                    <div className="col-span-6">Description</div>
                    <div className="col-span-2 text-center">Qty</div>
                    <div className="col-span-2 text-right">Unit Price</div>
                    <div className="col-span-2 text-right">Total</div>
                  </div>
                  
                  <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-50 pr-1">
                    {selectedSale.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 py-3.5 text-xs items-center">
                        <div className="col-span-6 pr-2">
                          <p className="font-bold text-slate-800">{item.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{item.variantName || 'Standard Package'}</p>
                        </div>
                        <div className="col-span-2 text-center text-slate-600">{item.quantity}</div>
                        <div className="col-span-2 text-right font-mono text-slate-600">
                          {currencySym} {item.price.toFixed(2)}
                        </div>
                        <div className="col-span-2 text-right font-semibold font-mono text-slate-800">
                          {currencySym} {(item.quantity * item.price).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calculations Block */}
                <div className="flex flex-col sm:flex-row justify-between items-start pt-6 border-t border-dashed border-slate-200 gap-6">
                  <div className="max-w-[200px] text-[10px] text-slate-400 leading-relaxed md:pt-1">
                    System-certified invoice. All calculations are final and locked on checkout confirmation.
                  </div>
                  <div className="w-full sm:w-60 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-semibold font-mono">{currencySym} {(selectedSale.total - (selectedSale.taxAmount || 0)).toFixed(2)}</span>
                    </div>
                    {selectedSale.taxRate ? (
                      <div className="flex justify-between text-slate-600">
                        <span>VAT ({selectedSale.taxRate || businessProfile.taxRate}%)</span>
                        <span className="font-semibold font-mono">{currencySym} {(selectedSale.taxAmount || 0).toFixed(2)}</span>
                      </div>
                    ) : ''}
                    <div className="h-px bg-slate-100" />
                    <div className="flex justify-between items-baseline pt-1">
                      <span className="font-extrabold text-slate-900 text-sm">Amount Due</span>
                      <span className="text-xl font-extrabold font-mono text-indigo-600">
                        {currencySym} {selectedSale.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer and Etims Control Details */}
                <div className="mt-8 pt-6 border-t border-slate-50 text-center space-y-1">
                  {selectedSale.etimsControlNumber && (
                    <p className="text-[9px] font-mono text-slate-400 tracking-wider">
                      eTIMS CONTROL: {selectedSale.etimsControlNumber}
                    </p>
                  )}
                  <p className="text-[9px] font-bold text-slate-400 leading-none">
                    Thank You For Dining or Staying With Us
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-card border border-border rounded-3xl p-16 flex flex-col items-center justify-center text-muted gap-4 shadow-sm text-center">
              <FileDown className="w-12 h-12 opacity-30 text-indigo-600 animate-pulse" />
              <p className="text-base font-bold text-ink">Select an Invoice to Preview</p>
              <p className="text-xs text-muted max-w-xs">
                Invoices history is locally stored. Go to Checkout POS to conclude a sale and automatically write a billing voucher ledger.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
