import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { BusinessProfile, BusinessType } from '../types';
import { Plus, Building2, Store, ChevronRight, Briefcase, Trash2, X, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { compressImage } from '../lib/imageUtils';

import { DMI_LOGO_URL, DMI_FALLBACK_ICON } from '../constants';

import { SafeImage } from './SafeImage';

interface BusinessSelectorProps {
  onSelect: (business: BusinessProfile) => void;
  onLogout: () => void;
}

export const BusinessSelector: React.FC<BusinessSelectorProps> = ({ onSelect, onLogout }) => {
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [businessToDelete, setBusinessToDelete] = useState<BusinessProfile | null>(null);
  const [newBusiness, setNewBusiness] = useState({
    name: '',
    type: 'RETAIL' as BusinessType,
    currency: 'USD',
    taxRate: 0,
    logo: '',
    mpesaConfig: {
      sendMoneyNumber: '',
      pochiNumber: '',
      paybillNumber: '',
      paybillAccount: '',
      tillNumber: '',
      passkey: '',
      consumerKey: '',
      consumerSecret: ''
    }
  });

  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const data = await db.getBusinesses();
        setBusinesses(data);
      } catch (error) {
        console.error('Error fetching businesses:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchBusinesses();
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string, 300, 300, 0.6);
        setNewBusiness({ ...newBusiness, logo: compressed });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate M-Pesa config
    const { mpesaConfig } = newBusiness;
    const hasMpesa = mpesaConfig.sendMoneyNumber || 
                     mpesaConfig.pochiNumber || 
                     (mpesaConfig.paybillNumber && mpesaConfig.paybillAccount) || 
                     mpesaConfig.tillNumber;
    
    if (!hasMpesa) {
      alert('Please provide at least one M-Pesa payment method (Send Money, Pochi, Paybill, or Till).');
      return;
    }

    // Add default trial subscription
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    const businessToCreate = {
      ...newBusiness,
      subscription: {
        id: Math.random().toString(36).substr(2, 9),
        businessId: '', // Will be updated by db or just left empty for now
        planId: 'trial',
        startDate: new Date().toISOString(),
        endDate: trialEndDate.toISOString(),
        status: 'ACTIVE' as const,
        autoRenew: false,
        amountPaid: 0,
        totalAmount: 0
      }
    };

    try {
      const created = await db.addBusiness(businessToCreate);
      setBusinesses([...businesses, created]);
      setShowCreate(false);
      onSelect(created);
    } catch (error) {
      console.error('Error creating business:', error);
      alert('Failed to create business. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await db.deleteBusiness(id);
      setBusinesses(businesses.filter(b => b.id !== id));
      setBusinessToDelete(null);
    } catch (error) {
      console.error('Error deleting business:', error);
      alert('Failed to delete business. Please try again.');
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
          <div className="w-20 h-20 bg-white border border-border rounded-3xl flex items-center justify-center mx-auto mb-6 overflow-hidden shadow-sm">
            <SafeImage 
              src={DMI_LOGO_URL} 
              alt="Logo" 
              className="w-full h-full object-contain p-2" 
              fallback={
                <img src={DMI_FALLBACK_ICON} alt="Fallback" className="w-full h-full object-contain p-2" />
              }
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-4xl font-black text-ink tracking-tight mb-4">Welcome to DMi Technologies</h1>
          <p className="text-muted text-lg">Select a business to continue or create a new one</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {businesses.map((business) => (
            <motion.div
              key={business.id}
              whileHover={{ scale: 1.02, translateY: -4 }}
              className="group relative"
            >
              <button
                onClick={() => onSelect(business)}
                className="w-full p-8 bg-card border border-border rounded-[32px] text-left hover:border-indigo-500/50 transition-all shadow-sm flex flex-col h-full"
              >
                <div className="w-20 h-20 bg-white border border-border rounded-2xl flex items-center justify-center mb-6 overflow-hidden group-hover:border-indigo-500/50 transition-all shadow-md">
                  <SafeImage 
                    src={business.logo} 
                    alt="Logo" 
                    className="w-full h-full object-contain p-2" 
                    fallback={
                      <img src="https://cdn-icons-png.flaticon.com/512/1055/1055644.png" alt="Fallback" className="w-full h-full object-contain p-2" />
                    }
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h3 className="text-xl font-bold text-ink mb-2">{business.name}</h3>
                <p className="text-sm text-muted uppercase tracking-wider font-bold mb-4">{business.type}</p>
                <div className="mt-auto flex items-center text-indigo-600 font-bold text-sm">
                  Enter Business <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setBusinessToDelete(business);
                }}
                className="absolute top-4 right-4 p-3 bg-rose-50 text-rose-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-600 hover:text-white shadow-sm"
                title="Delete Business"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </motion.div>
          ))}

          <motion.button
            whileHover={{ scale: 1.02, translateY: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreate(true)}
            className="p-8 bg-bg border-2 border-dashed border-border rounded-[32px] text-left hover:border-indigo-500/50 transition-all flex flex-col items-center justify-center text-muted hover:text-indigo-600 group"
          >
            <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mb-4 group-hover:bg-indigo-500/10 transition-colors">
              <Plus className="w-7 h-7" />
            </div>
            <span className="font-bold">Create New Business</span>
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {businessToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-card w-full max-w-md rounded-[40px] p-10 shadow-2xl border border-border text-center"
            >
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-ink mb-2">Delete Business?</h2>
              <p className="text-muted mb-8">
                Are you sure you want to delete <strong>{businessToDelete.name}</strong>? 
                This will permanently remove all shops, products, and sales data associated with this business.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setBusinessToDelete(null)}
                  className="flex-1 px-6 py-4 bg-bg text-ink font-bold rounded-2xl border border-border hover:bg-muted transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(businessToDelete.id)}
                  className="flex-1 px-6 py-4 bg-rose-600 text-white font-bold rounded-2xl hover:bg-rose-700 shadow-lg shadow-rose-500/20 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-card w-full max-w-md rounded-[40px] p-10 shadow-2xl border border-border"
            >
              <h2 className="text-2xl font-black text-ink mb-8">New Business</h2>
              <form onSubmit={handleCreate} className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                <div className="flex flex-col items-center gap-4 mb-6">
                  <div className="w-24 h-24 bg-white border-2 border-dashed border-border rounded-3xl flex items-center justify-center overflow-hidden group relative shadow-sm">
                    <SafeImage 
                      src={newBusiness.logo} 
                      alt="Logo" 
                      className="w-full h-full object-contain p-2" 
                      fallback={
                        <img 
                          src={DMI_LOGO_URL} 
                          alt="Logo" 
                          className="w-full h-full object-contain p-2 opacity-50" 
                          onError={(e) => {
                            e.currentTarget.src = DMI_FALLBACK_ICON;
                          }}
                          referrerPolicy="no-referrer"
                        />
                      }
                      referrerPolicy="no-referrer" 
                    />
                    <label className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Plus className="w-6 h-6 text-white" />
                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    </label>
                  </div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Business Logo</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Business Name</label>
                  <input
                    required
                    type="text"
                    value={newBusiness.name}
                    onChange={(e) => setNewBusiness({ ...newBusiness, name: e.target.value })}
                    className="w-full px-6 py-4 bg-bg border border-border rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all"
                    placeholder="e.g. My Supermarket"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Business Type</label>
                  <select
                    value={newBusiness.type}
                    onChange={(e) => setNewBusiness({ ...newBusiness, type: e.target.value as BusinessType })}
                    className="w-full px-6 py-4 bg-bg border border-border rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all"
                  >
                    <option value="RETAIL">Supermarket / Retail</option>
                    <option value="HARDWARE">Hardware / Electronics</option>
                    <option value="PHARMACY">Pharmacy / Chemist</option>
                    <option value="BOOKSHOP">Bookshop / Stationery</option>
                    <option value="GROCERY">Groceries & Fruits</option>
                    <option value="AUTOSPARE">Auto Spare Shop</option>
                    <option value="LIQUOR">Liquor / Wines & Spirits</option>
                    <option value="RESTAURANT">Restaurant</option>
                    <option value="FAST_FOOD">Fast Food</option>
                    <option value="SALON_BARBER">Salon & Barber</option>
                    <option value="BOUTIQUE">Boutique & Clothing</option>
                    <option value="BAR_RESTAURANT">Bar & Restaurant</option>
                    <option value="PETROL_STATION">Petrol Station</option>
                    <option value="HOTEL">Hotel</option>
                    <option value="OTHER">Other / General Business</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Currency</label>
                    <input
                      type="text"
                      value={newBusiness.currency}
                      onChange={(e) => setNewBusiness({ ...newBusiness, currency: e.target.value })}
                      className="w-full px-6 py-4 bg-bg border border-border rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Tax Rate (%)</label>
                    <input
                      type="number"
                      value={newBusiness.taxRate || 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setNewBusiness({ ...newBusiness, taxRate: isNaN(val) ? 0 : val });
                      }}
                      className="w-full px-6 py-4 bg-bg border border-border rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <h3 className="text-sm font-black text-ink uppercase tracking-wider">M-Pesa Payment Details</h3>
                  <p className="text-[10px] text-muted font-bold uppercase">Provide at least one method</p>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Send Money Number</label>
                      <input
                        type="tel"
                        value={newBusiness.mpesaConfig.sendMoneyNumber}
                        onChange={(e) => setNewBusiness({ 
                          ...newBusiness, 
                          mpesaConfig: { ...newBusiness.mpesaConfig, sendMoneyNumber: e.target.value } 
                        })}
                        className="w-full px-6 py-3 bg-bg border border-border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all"
                        placeholder="e.g. 0712345678"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Pochi la Biashara Number</label>
                      <input
                        type="tel"
                        value={newBusiness.mpesaConfig.pochiNumber}
                        onChange={(e) => setNewBusiness({ 
                          ...newBusiness, 
                          mpesaConfig: { ...newBusiness.mpesaConfig, pochiNumber: e.target.value } 
                        })}
                        className="w-full px-6 py-3 bg-bg border border-border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all"
                        placeholder="e.g. 0712345678"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Paybill Number</label>
                        <input
                          type="text"
                          value={newBusiness.mpesaConfig.paybillNumber}
                          onChange={(e) => setNewBusiness({ 
                            ...newBusiness, 
                            mpesaConfig: { ...newBusiness.mpesaConfig, paybillNumber: e.target.value } 
                          })}
                          className="w-full px-6 py-3 bg-bg border border-border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all"
                          placeholder="e.g. 123456"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Account Number</label>
                        <input
                          type="text"
                          value={newBusiness.mpesaConfig.paybillAccount}
                          onChange={(e) => setNewBusiness({ 
                            ...newBusiness, 
                            mpesaConfig: { ...newBusiness.mpesaConfig, paybillAccount: e.target.value } 
                          })}
                          className="w-full px-6 py-3 bg-bg border border-border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all"
                          placeholder="e.g. SHOP01"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Buy Goods Till Number</label>
                      <input
                        type="text"
                        value={newBusiness.mpesaConfig.tillNumber}
                        onChange={(e) => setNewBusiness({ 
                          ...newBusiness, 
                          mpesaConfig: { ...newBusiness.mpesaConfig, tillNumber: e.target.value } 
                        })}
                        className="w-full px-6 py-3 bg-bg border border-border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all"
                        placeholder="e.g. 123456"
                      />
                    </div>
                  </div>
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
                    className="flex-1 px-6 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all"
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
