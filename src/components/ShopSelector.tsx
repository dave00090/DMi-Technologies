import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Shop, BusinessProfile } from '../types';
import { Plus, Store, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SafeImage } from './SafeImage';
import { BRAND_LOGO_URL, DMI_FALLBACK_ICON } from '../constants';

interface ShopSelectorProps {
  business: BusinessProfile;
  onSelect: (shop: Shop) => void;
  onBack: () => void;
  onLogout: () => void;
}

export const ShopSelector: React.FC<ShopSelectorProps> = ({ business, onSelect, onBack, onLogout }) => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newShop, setNewShop] = useState({
    name: '',
    location: '',
    phone: ''
  });

  useEffect(() => {
    if (!business?.id) return;
    const fetchShops = async () => {
      try {
        const data = await db.getShops(business.id);
        setShops(data);
      } catch (error) {
        console.error('Error fetching shops:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchShops();
  }, [business?.id]);

  if (!business) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-muted mb-4">Business profile not found</p>
          <button onClick={onBack} className="text-indigo-600 font-bold">Go Back</button>
        </div>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await db.addShop({
        ...newShop,
        businessId: business.id
      });
      setShops([...shops, created]);
      setShowCreate(false);
      onSelect(created);
    } catch (error) {
      console.error('Error creating shop:', error);
      alert('Failed to create shop. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6 relative">
      <button
        onClick={onLogout}
        className="absolute top-8 right-8 flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-muted hover:text-rose-600 transition-all font-bold text-sm shadow-sm"
      >
        Logout Account
      </button>

      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <button
            onClick={onBack}
            className="flex items-center text-muted hover:text-indigo-600 font-bold text-sm mb-6 mx-auto transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Change Business
          </button>
          <div className="w-20 h-20 bg-white border border-border rounded-3xl flex items-center justify-center mx-auto mb-6 overflow-hidden shadow-sm">
            <SafeImage 
              src={BRAND_LOGO_URL} 
              alt="Logo" 
              className="w-full h-full object-contain p-2" 
              fallback={<Store className="w-10 h-10 text-slate-300" />}
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-4xl font-black text-ink tracking-tight mb-4">{business.name}</h1>
          <p className="text-muted text-lg">Select a shop location to continue</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shops.map((shop) => (
            <motion.button
              key={shop.id}
              whileHover={{ scale: 1.02, translateY: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(shop)}
              className="p-8 bg-card border border-border rounded-[32px] text-left hover:border-emerald-500/50 transition-all shadow-sm group"
            >
              <div className="w-20 h-20 bg-white border border-border rounded-2xl flex items-center justify-center mb-6 overflow-hidden group-hover:border-emerald-500/50 transition-all shadow-md">
                <SafeImage 
                  src={business.logo || BRAND_LOGO_URL} 
                  alt="Logo" 
                  className="w-full h-full object-contain p-2" 
                  fallback={<Store className="w-10 h-10 text-slate-300" />}
                  referrerPolicy="no-referrer"
                />
              </div>
              <h3 className="text-xl font-bold text-ink mb-2">{shop.name}</h3>
              <p className="text-sm text-muted mb-4">{shop.location || 'No location set'}</p>
              <div className="flex items-center text-emerald-600 font-bold text-sm">
                Enter Shop <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </motion.button>
          ))}

          <motion.button
            whileHover={{ scale: 1.02, translateY: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreate(true)}
            className="p-8 bg-bg border-2 border-dashed border-border rounded-[32px] text-left hover:border-emerald-500/50 transition-all flex flex-col items-center justify-center text-muted hover:text-emerald-600 group"
          >
            <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mb-4 group-hover:bg-emerald-500/10 transition-colors">
              <Plus className="w-7 h-7" />
            </div>
            <span className="font-bold">Add New Shop</span>
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-card w-full max-w-md rounded-[40px] p-10 shadow-2xl border border-border"
            >
              <h2 className="text-2xl font-black text-ink mb-8">New Shop</h2>
              <form onSubmit={handleCreate} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Shop Name</label>
                  <input
                    required
                    type="text"
                    value={newShop.name}
                    onChange={(e) => setNewShop({ ...newShop, name: e.target.value })}
                    className="w-full px-6 py-4 bg-bg border border-border rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium transition-all"
                    placeholder="e.g. Downtown Branch"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Location</label>
                  <input
                    type="text"
                    value={newShop.location}
                    onChange={(e) => setNewShop({ ...newShop, location: e.target.value })}
                    className="w-full px-6 py-4 bg-bg border border-border rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium transition-all"
                    placeholder="e.g. 123 Main St"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Phone</label>
                  <input
                    type="text"
                    value={newShop.phone}
                    onChange={(e) => setNewShop({ ...newShop, phone: e.target.value })}
                    className="w-full px-6 py-4 bg-bg border border-border rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium transition-all"
                    placeholder="e.g. +1 234 567 890"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 px-6 py-4 bg-bg text-ink font-bold rounded-2xl border border-border hover:bg-muted transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
