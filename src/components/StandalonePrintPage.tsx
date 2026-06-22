import React, { useEffect, useState } from 'react';
import { Sale, BusinessProfile } from '../types';
import { localDb, initDb } from '../services/localDb';
import { Receipt } from './Receipt';

export const StandalonePrintPage: React.FC<{ saleId: string }> = ({ saleId }) => {
  const [loading, setLoading] = useState(true);
  const [sale, setSale] = useState<Sale | null>(null);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        await initDb();
        const businesses = localDb.getBusinesses();
        let foundSale: Sale | null = null;
        
        for (const biz of businesses) {
          const sales = await localDb.getSales(biz.id);
          const s = sales.find(item => item.id === saleId);
          if (s) {
            foundSale = s;
            break;
          }
        }

        if (foundSale) {
          setSale(foundSale);
          const biz = localDb.getBusinessById(foundSale.businessId);
          if (biz) setBusiness(biz);
        }
      } catch (err) {
        console.error('Error loading standalone print sale:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [saleId]);

  useEffect(() => {
    if (sale && business) {
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [sale, business]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-slate-800 flex flex-col items-center justify-center font-sans">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold tracking-widest uppercase text-slate-400">Loading receipt details...</p>
      </div>
    );
  }

  if (!sale || !business) {
    return (
      <div className="min-h-screen bg-white text-slate-800 flex flex-col items-center justify-center font-sans p-6 text-center">
        <p className="text-sm font-black text-rose-500 uppercase tracking-widest mb-2">Receipt Not Found</p>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed mb-6">
          The requested receipt is missing or could not be decrypted. Ensure you are on the same device where the sale was finalized.
        </p>
        <button 
          onClick={() => window.close()} 
          className="px-6 py-2.5 bg-slate-900 border border-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-all pointer-events-auto"
        >
          Close Window
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-8 px-4 font-mono select-text">
      <div id="print-receipt" className="bg-white">
        <Receipt sale={sale} businessProfile={business} />
      </div>
      <div className="text-center mt-8 no-print pb-12">
        <div className="max-w-xs mx-auto space-y-3">
          <button 
            onClick={() => window.print()} 
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
          >
            Re-Trigger Print
          </button>
          <button 
            onClick={() => window.close()} 
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-750 rounded-xl text-xs font-bold transition-all uppercase tracking-widest"
          >
            Close Tab
          </button>
        </div>
      </div>
    </div>
  );
};
