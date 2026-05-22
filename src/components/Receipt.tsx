import React, { forwardRef } from 'react';
import { Sale, BusinessProfile } from '../types';
import { format } from 'date-fns';
import { ShoppingBag } from 'lucide-react';
import { SafeImage } from './SafeImage';

interface ReceiptProps {
  sale: Sale;
  businessProfile: BusinessProfile;
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(({ sale, businessProfile }, ref) => {
  const formatCurrency = (amount: number) => {
    return `${businessProfile.currency}${amount.toFixed(2)}`;
  };

  const taxAmount = (sale.total * businessProfile.taxRate) / 100;

  return (
    <div ref={ref} className="p-12 bg-white text-black receipt-font max-w-[420px] mx-auto shadow-sm border border-slate-100 print:p-10 print:shadow-none print:border-none">
      <div className="text-center mb-10">
        <div className="flex flex-col items-center gap-3 mb-6">
          <SafeImage 
            src={businessProfile.logo} 
            alt="Logo" 
            className="w-16 h-16 object-contain" 
            fallback={
              <div className="w-14 h-14 bg-black flex items-center justify-center rounded-full">
                <ShoppingBag className="text-white w-7 h-7" />
              </div>
            }
            referrerPolicy="no-referrer"
          />
          <h1 className="text-3xl font-black uppercase tracking-[0.2em] leading-none">{businessProfile.name}</h1>
          <div className="h-0.5 w-32 bg-black/20" />
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">{businessProfile.type.replace('_', ' ')}</p>
        </div>
        
        <div className="space-y-1.5 text-xs text-slate-600 leading-relaxed">
          <p className="font-bold text-black tracking-wider uppercase">{businessProfile.name} STORE</p>
          {businessProfile.address && <p>{businessProfile.address}</p>}
          {businessProfile.phone && <p className="pt-1">Tel: {businessProfile.phone}</p>}
          {businessProfile.email && <p className="hover:text-black transition-colors">{businessProfile.email}</p>}
        </div>
      </div>

      <div className="border-y-2 border-black py-6 mb-8 space-y-2.5 text-xs">
        <div className="flex justify-between">
          <span className="font-bold text-slate-400 tracking-tighter">DATE:</span>
          <span className="font-bold">{format(new Date(sale.timestamp), 'MMM dd, yyyy HH:mm')}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold text-slate-400 tracking-tighter">RECEIPT #:</span>
          <span className="font-bold">{sale.id.toUpperCase()}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold text-slate-400 tracking-tighter">CASHIER:</span>
          <span className="font-bold">{sale.cashierName.toUpperCase()}</span>
        </div>
        {sale.customerName && (
          <div className="flex justify-between pt-2 border-t border-slate-100 mt-2">
            <span className="font-bold text-slate-400 tracking-tighter">CUSTOMER:</span>
            <span className="font-bold">{sale.customerName.toUpperCase()}</span>
          </div>
        )}
      </div>

      <div className="mb-10">
        <div className="flex justify-between text-xs font-black mb-5 border-b-2 border-black pb-3 tracking-widest">
          <span className="w-1/2">DESCRIPTION</span>
          <span className="w-1/6 text-center">QTY</span>
          <span className="w-1/3 text-right">AMOUNT</span>
        </div>
        <div className="space-y-6">
          {sale.items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-xs leading-normal">
              <div className="w-1/2">
                <p className="font-bold text-black text-[13px]">{item.name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{item.variantName}</p>
                <p className="text-[9px] text-slate-400 mt-1 font-medium italic">Unit Price: {formatCurrency(item.price)}</p>
              </div>
              <span className="w-1/6 text-center font-bold text-sm">{item.quantity}</span>
              <span className="w-1/3 text-right font-bold text-sm">{formatCurrency(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t-2 border-black pt-6 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500 font-medium uppercase tracking-widest">SUBTOTAL</span>
          <span className="font-bold">{formatCurrency(sale.total + (sale.discount?.amount || 0))}</span>
        </div>
        {sale.discount && (
          <div className="flex justify-between text-emerald-600">
            <span className="font-medium uppercase tracking-widest">DISCOUNT ({sale.discount.type === 'percentage' ? `${sale.discount.value}%` : formatCurrency(sale.discount.value)})</span>
            <span className="font-bold">-{formatCurrency(sale.discount.amount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-500 font-medium uppercase tracking-widest">SALES TAX ({businessProfile.taxRate}%)</span>
          <span className="font-bold">{formatCurrency(taxAmount)}</span>
        </div>
        {sale.discount && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Discount Details</p>
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>
                {sale.discount.type === 'percentage' ? 'PERCENTAGE OFF' : 'FIXED AMOUNT OFF'}
                {sale.discount.code && <span className="ml-2 text-[9px] bg-emerald-100 px-1.5 py-0.5 rounded">CODE: {sale.discount.code}</span>}
              </span>
              <span>
                {sale.discount.type === 'percentage' ? `${sale.discount.value}%` : formatCurrency(sale.discount.value)}
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-between font-black text-2xl pt-4 border-t-2 border-slate-100 mt-3">
          <span className="tracking-widest">TOTAL</span>
          <span>{formatCurrency(sale.total)}</span>
        </div>

        {sale.paymentMethod === 'CASH' && sale.cashReceived !== undefined && (
          <div className="mt-4 pt-4 border-t-2 border-black space-y-2">
            <div className="flex justify-between text-sm font-black">
              <span className="uppercase tracking-widest">CASH RECEIVED</span>
              <span>{formatCurrency(sale.cashReceived)}</span>
            </div>
            <div className="flex justify-between text-sm font-black border-t border-slate-100 pt-2">
              <span className="uppercase tracking-widest text-slate-500">CHANGE DUE</span>
              <span className="text-xl">{formatCurrency(sale.change || 0)}</span>
            </div>
          </div>
        )}
      </div>

      {/* eTIMS Section */}
      <div className="mt-10 p-6 bg-slate-50 border-2 border-slate-200 rounded-2xl">
        <div className="flex items-start gap-4">
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">eTIMS Electronic Tax Invoice</p>
              <p className="text-[9px] text-slate-400 font-medium">Kenya Revenue Authority Verified</p>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500 font-bold">CONTROL #:</span>
                <span className="font-mono font-black">{sale.etimsControlNumber}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500 font-bold">VAT ({sale.taxRate}%):</span>
                <span className="font-black">{formatCurrency(sale.taxAmount || 0)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500 font-bold">TAXABLE AMT:</span>
                <span className="font-black">{formatCurrency(sale.total - (sale.taxAmount || 0))}</span>
              </div>
            </div>
          </div>
          
          {sale.etimsQrCode && (
            <div className="w-20 h-20 bg-white p-1 border border-slate-200 rounded-lg flex items-center justify-center">
              {/* Mock QR Code */}
              <div className="w-full h-full bg-slate-100 flex flex-wrap p-1 gap-0.5">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className={`w-[18%] h-[18%] ${Math.random() > 0.5 ? 'bg-black' : 'bg-transparent'}`} />
                ))}
              </div>
            </div>
          )}
        </div>
        <p className="text-[8px] text-slate-400 mt-4 text-center font-medium uppercase tracking-widest">Scan to verify tax compliance</p>
      </div>

      <div className="text-center mt-14 space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-black tracking-[0.15em]">THANK YOU FOR YOUR PURCHASE</p>
          <p className="text-[10px] text-slate-500 italic leading-relaxed px-4">"Style is a way to say who you are without having to speak."</p>
        </div>
        
        <div className="pt-8 flex flex-col items-center gap-4">
          <div className="w-full h-20 bg-black flex items-center justify-center p-3">
            <div className="w-full h-full border border-white/20 flex items-center justify-center">
              <span className="text-white text-xs tracking-[1.2em] font-light ml-[1.2em] uppercase">{businessProfile.name}-POS</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-[9px] text-slate-400 uppercase tracking-[0.2em] font-bold">Digital Verification Code</p>
            <p className="text-xs font-mono font-black tracking-widest">{sale.id.slice(0, 8).toUpperCase()}-{sale.id.slice(-8).toUpperCase()}</p>
          </div>
        </div>
        
        <p className="text-[9px] text-slate-400 pt-6 border-t border-slate-100 leading-relaxed">
          Returns accepted within 30 days with original receipt and tags attached.
        </p>
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';
