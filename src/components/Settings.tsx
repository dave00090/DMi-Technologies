import React, { useState } from 'react';
import { localAuth } from '../services/localAuth';
import { UserProfile, ThemeConfig, BusinessProfile, BusinessType } from '../types';
import { 
  Palette, 
  CheckCircle2, 
  RefreshCcw,
  Layout,
  Type,
  Moon,
  Sun,
  Building2,
  Globe,
  Phone,
  Mail,
  MapPin,
  Coins,
  Percent,
  Plus,
  Smartphone,
  Copy,
  Trash2,
  AlertTriangle,
  History as HistoryIcon
} from 'lucide-react';
import { localDb, removeLocal } from '../services/localDb';
import { motion, AnimatePresence } from 'motion/react';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { compressImage } from '../lib/imageUtils';
import { SafeImage } from './SafeImage';

interface SettingsProps {
  user: UserProfile;
  businessId: string;
  shopId: string;
  onBackToBusiness: () => void;
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
}

const PRESET_THEMES: { name: string, config: ThemeConfig }[] = [
  {
    name: 'DMi Default',
    config: { primaryColor: '#4f46e5', secondaryColor: '#7c3aed', accentColor: '#10b981' }
  },
  {
    name: 'Midnight Rose',
    config: { primaryColor: '#e11d48', secondaryColor: '#881337', accentColor: '#fbbf24' }
  },
  {
    name: 'Ocean Breeze',
    config: { primaryColor: '#0891b2', secondaryColor: '#1e40af', accentColor: '#f59e0b' }
  },
  {
    name: 'Emerald Forest',
    config: { primaryColor: '#059669', secondaryColor: '#064e3b', accentColor: '#ec4899' }
  }
];

export const Settings: React.FC<SettingsProps> = ({ user, businessId, shopId, onBackToBusiness, zoomLevel, setZoomLevel }) => {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(user.theme || PRESET_THEMES[0].config);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(localDb.getBusinessById(businessId)!);
  const activeShop = localDb.getShopById(shopId);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteBusiness = async () => {
    await localDb.deleteBusiness(businessId);
    onBackToBusiness();
  };

  const handleUpdateBusiness = async (updates: Partial<BusinessProfile>) => {
    await localDb.updateBusiness(businessId, updates);
    setBusinessProfile(prev => ({ ...prev, ...updates }));
    showSuccess('Business profile updated');
  };

  const handleApplyTheme = async (theme: ThemeConfig) => {
    try {
      localAuth.updateUser(user.uid, { theme });
      
      setCurrentTheme(theme);
      
      // Apply CSS variables globally
      document.documentElement.style.setProperty('--primary-color', theme.primaryColor);
      document.documentElement.style.setProperty('--secondary-color', theme.secondaryColor);
      document.documentElement.style.setProperty('--accent-color', theme.accentColor);
      
      if (theme.darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      showSuccess('Theme updated successfully');
    } catch (error) {
      console.error("Settings error:", error);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result as string, 300, 300, 0.6);
          handleUpdateBusiness({ logo: compressed });
        } catch (error) {
          console.error('Logo compression failed:', error);
          handleUpdateBusiness({ logo: reader.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 right-8 z-[110] bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-bold">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
        <div className="flex items-center gap-8 mb-12">
          <div className="relative group">
            <div className="w-24 h-24 bg-muted border-2 border-dashed border-border rounded-3xl flex items-center justify-center overflow-hidden">
              <SafeImage 
                src={businessProfile.logo} 
                alt="Logo" 
                className="w-full h-full object-contain" 
                fallback={<Building2 className="w-8 h-8 text-muted" />}
                referrerPolicy="no-referrer" 
              />
            </div>
            <label className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-3xl">
              <Plus className="w-6 h-6 text-white" />
              <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
            </label>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-ink">Business Profile</h2>
                <p className="text-muted">Configure your business type and contact information</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-ink opacity-70 mb-2">Business Name</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  value={businessProfile.name || ''}
                  onChange={(e) => handleUpdateBusiness({ name: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-muted border border-border rounded-xl text-ink focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="DMi Technologies"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-ink opacity-70 mb-2">Business Type</label>
              <select
                value={businessProfile.type}
                onChange={(e) => handleUpdateBusiness({ type: e.target.value as BusinessType })}
                className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-ink focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="RETAIL">Supermarket / Retail</option>
                <option value="HARDWARE">Hardware / Electronics</option>
                <option value="PHARMACY">Pharmacy / Chemist</option>
                <option value="BOOKSHOP">Bookshop / Stationery</option>
                <option value="GROCERY">Groceries & Fruits</option>
                <option value="AUTOSPARE">Auto-spare Shop</option>
                <option value="LIQUOR">Liquor / Wines & Spirits</option>
                <option value="RESTAURANT">Restaurant / Cafe</option>
                <option value="FAST_FOOD">Fast Food / Takeaway</option>
                <option value="SALON_BARBER">Salon / Barbershop</option>
                <option value="BOUTIQUE">Boutique / Fashion</option>
                <option value="BAR_RESTAURANT">Bar & Restaurant</option>
                <option value="PETROL_STATION">Petrol Station</option>
                <option value="HOTEL">Hotel / Guest House</option>
                <option value="OTHER">Other / General Business</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-ink opacity-70 mb-2">Currency</label>
                <div className="relative">
                  <Coins className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="text"
                    value={businessProfile.currency || ''}
                    onChange={(e) => handleUpdateBusiness({ currency: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-muted border border-border rounded-xl text-ink focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="USD"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-ink opacity-70 mb-2">Tax Rate (%)</label>
                <div className="relative">
                  <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="number"
                    value={businessProfile.taxRate || 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      handleUpdateBusiness({ taxRate: isNaN(val) ? 0 : val });
                    }}
                    className="w-full pl-12 pr-4 py-3 bg-muted border border-border rounded-xl text-ink focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-ink opacity-70 mb-2">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  value={businessProfile.phone || ''}
                  onChange={(e) => handleUpdateBusiness({ phone: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-muted border border-border rounded-xl text-ink focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="+1 234 567 890"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-ink opacity-70 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="email"
                  value={businessProfile.email || ''}
                  onChange={(e) => handleUpdateBusiness({ email: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-muted border border-border rounded-xl text-ink focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="contact@business.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-ink opacity-70 mb-2">Address</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  value={businessProfile.address || ''}
                  onChange={(e) => handleUpdateBusiness({ address: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-muted border border-border rounded-xl text-ink focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="123 Business St, City"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400">
            <Phone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-ink">M-Pesa Configuration</h2>
            <p className="text-muted">Configure your M-Pesa payment receiving details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-ink opacity-70 mb-2">Send Money Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  value={businessProfile.mpesaConfig?.sendMoneyNumber || ''}
                  onChange={(e) => handleUpdateBusiness({ 
                    mpesaConfig: { ...businessProfile.mpesaConfig, sendMoneyNumber: e.target.value } 
                  })}
                  className="w-full pl-12 pr-4 py-3 bg-muted border border-border rounded-xl text-ink focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="0712345678"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-ink opacity-70 mb-2">Pochi la Biashara Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  value={businessProfile.mpesaConfig?.pochiNumber || ''}
                  onChange={(e) => handleUpdateBusiness({ 
                    mpesaConfig: { ...businessProfile.mpesaConfig, pochiNumber: e.target.value } 
                  })}
                  className="w-full pl-12 pr-4 py-3 bg-muted border border-border rounded-xl text-ink focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="0712345678"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-ink opacity-70 mb-2">Paybill Number</label>
                <input
                  type="text"
                  value={businessProfile.mpesaConfig?.paybillNumber || ''}
                  onChange={(e) => handleUpdateBusiness({ 
                    mpesaConfig: { ...businessProfile.mpesaConfig, paybillNumber: e.target.value } 
                  })}
                  className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-ink focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="123456"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-ink opacity-70 mb-2">Account Number</label>
                <input
                  type="text"
                  value={businessProfile.mpesaConfig?.paybillAccount || ''}
                  onChange={(e) => handleUpdateBusiness({ 
                    mpesaConfig: { ...businessProfile.mpesaConfig, paybillAccount: e.target.value } 
                  })}
                  className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-ink focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="DMI-001"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-ink opacity-70 mb-2">Buy Goods Till Number</label>
              <div className="relative">
                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  value={businessProfile.mpesaConfig?.tillNumber || ''}
                  onChange={(e) => handleUpdateBusiness({ 
                    mpesaConfig: { ...businessProfile.mpesaConfig, tillNumber: e.target.value.trim() } 
                  })}
                  className="w-full pl-12 pr-4 py-3 bg-muted border border-border rounded-xl text-ink focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="123456"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <Moon className="w-5 h-5" />
              Display Mode
            </h3>
            <div className="flex items-center gap-4 p-4 bg-muted rounded-2xl border border-border">
              <button
                onClick={() => handleApplyTheme({ ...currentTheme, darkMode: false })}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
                  !currentTheme.darkMode 
                    ? 'bg-card text-indigo-600 shadow-sm border border-indigo-100 dark:border-indigo-900/50' 
                    : 'text-muted hover:bg-card/50'
                }`}
              >
                <Sun className="w-4 h-4" />
                Light
              </button>
              <button
                onClick={() => handleApplyTheme({ ...currentTheme, darkMode: true })}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
                  currentTheme.darkMode 
                    ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-lg' 
                    : 'text-muted hover:bg-card/50'
                }`}
              >
                <Moon className="w-4 h-4" />
                Dark
              </button>
            </div>

            <h3 className="text-lg font-bold text-ink flex items-center gap-2 pt-4">
              <Smartphone className="w-5 h-5 text-indigo-600" />
              Interface Scaling (Zoom)
            </h3>
            <div className="p-4 bg-muted rounded-2xl border border-border space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-ink opacity-70">Current Zoom: {Math.round(zoomLevel * 100)}%</span>
                <button 
                  onClick={() => setZoomLevel(1)}
                  className="text-xs font-bold text-indigo-600 hover:underline"
                >
                  Reset to Default
                </button>
              </div>
              <input 
                type="range" 
                min="0.7" 
                max="1.5" 
                step="0.05" 
                value={zoomLevel}
                onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] font-bold text-muted uppercase">
                <span>0.7x (Small)</span>
                <span>1.0x (Normal)</span>
                <span>1.5x (Large)</span>
              </div>
            </div>

            <h3 className="text-lg font-bold text-ink flex items-center gap-2 pt-4">
              <Layout className="w-5 h-5" />
              Preset Themes
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {PRESET_THEMES.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => handleApplyTheme(theme.config)}
                  className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between group ${
                    JSON.stringify(currentTheme) === JSON.stringify(theme.config)
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-border hover:border-slate-200 dark:hover:border-slate-700 bg-card'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-2">
                      <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800" style={{ backgroundColor: theme.config.primaryColor }} />
                      <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800" style={{ backgroundColor: theme.config.secondaryColor }} />
                      <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800" style={{ backgroundColor: theme.config.accentColor }} />
                    </div>
                    <span className={`font-bold ${JSON.stringify(currentTheme) === JSON.stringify(theme.config) ? 'text-indigo-700 dark:text-indigo-400' : 'text-ink opacity-70'}`}>
                      {theme.name}
                    </span>
                  </div>
                  {JSON.stringify(currentTheme) === JSON.stringify(theme.config) && (
                    <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <RefreshCcw className="w-5 h-5" />
              Custom Colors
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-ink opacity-70 mb-2">Primary Color</label>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    className="w-12 h-12 rounded-lg cursor-pointer border-none bg-transparent"
                    value={currentTheme.primaryColor}
                    onChange={(e) => setCurrentTheme({ ...currentTheme, primaryColor: e.target.value })}
                  />
                  <input
                    type="text"
                    className="flex-1 px-4 py-2 bg-muted border border-border rounded-xl font-mono text-sm text-ink"
                    value={currentTheme.primaryColor}
                    onChange={(e) => setCurrentTheme({ ...currentTheme, primaryColor: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-ink opacity-70 mb-2">Secondary Color</label>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    className="w-12 h-12 rounded-lg cursor-pointer border-none bg-transparent"
                    value={currentTheme.secondaryColor}
                    onChange={(e) => setCurrentTheme({ ...currentTheme, secondaryColor: e.target.value })}
                  />
                  <input
                    type="text"
                    className="flex-1 px-4 py-2 bg-muted border border-border rounded-xl font-mono text-sm text-ink"
                    value={currentTheme.secondaryColor}
                    onChange={(e) => setCurrentTheme({ ...currentTheme, secondaryColor: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-ink opacity-70 mb-2">Accent Color</label>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    className="w-12 h-12 rounded-lg cursor-pointer border-none bg-transparent"
                    value={currentTheme.accentColor}
                    onChange={(e) => setCurrentTheme({ ...currentTheme, accentColor: e.target.value })}
                  />
                  <input
                    type="text"
                    className="flex-1 px-4 py-2 bg-muted border border-border rounded-xl font-mono text-sm text-ink"
                    value={currentTheme.accentColor}
                    onChange={(e) => setCurrentTheme({ ...currentTheme, accentColor: e.target.value })}
                  />
                </div>
              </div>
              <button
                onClick={() => handleApplyTheme(currentTheme)}
                className="w-full py-3 bg-slate-900 dark:bg-indigo-600 text-white font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all shadow-lg"
              >
                Apply Custom Theme
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
        <h3 className="text-lg font-bold text-ink mb-6 flex items-center gap-2">
          <Type className="w-5 h-5" />
          Interface Preview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl border border-border" style={{ borderLeft: `4px solid ${currentTheme.primaryColor}` }}>
            <p className="text-[10px] font-bold text-muted uppercase mb-1">Primary Button</p>
            <button className="px-4 py-2 rounded-lg text-white text-sm font-bold" style={{ backgroundColor: currentTheme.primaryColor }}>
              Action
            </button>
          </div>
          <div className="p-4 rounded-2xl border border-border" style={{ borderLeft: `4px solid ${currentTheme.secondaryColor}` }}>
            <p className="text-[10px] font-bold text-muted uppercase mb-1">Secondary Button</p>
            <button className="px-4 py-2 rounded-lg text-white text-sm font-bold" style={{ backgroundColor: currentTheme.secondaryColor }}>
              Secondary
            </button>
          </div>
          <div className="p-4 rounded-2xl border border-border" style={{ borderLeft: `4px solid ${currentTheme.accentColor}` }}>
            <p className="text-[10px] font-bold text-muted uppercase mb-1">Accent Badge</p>
            <span className="px-3 py-1 rounded-full text-white text-[10px] font-bold uppercase" style={{ backgroundColor: currentTheme.accentColor }}>
              New Alert
            </span>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-400">
              <HistoryIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-ink">Login History</h2>
              <p className="text-muted">Track recent login attempts and security events</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="py-4 px-4 text-xs font-bold text-muted uppercase tracking-wider">User</th>
                <th className="py-4 px-4 text-xs font-bold text-muted uppercase tracking-wider">Timestamp</th>
                <th className="py-4 px-4 text-xs font-bold text-muted uppercase tracking-wider">Role</th>
                <th className="py-4 px-4 text-xs font-bold text-muted uppercase tracking-wider">IP Address</th>
                <th className="py-4 px-4 text-xs font-bold text-muted uppercase tracking-wider">Device</th>
                <th className="py-4 px-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {localDb.getLoginHistory().map((login) => (
                <tr key={login.id} className="hover:bg-bg/30 transition-colors">
                  <td className="py-4 px-4">
                    <p className="text-sm font-bold text-ink">{login.userName}</p>
                    <p className="text-[10px] text-muted font-mono">{login.userId}</p>
                  </td>
                  <td className="py-4 px-4 text-sm text-muted">
                    {new Date(login.timestamp).toLocaleString()}
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-1 bg-bg border border-border rounded-lg text-[10px] font-bold uppercase text-muted">
                      {login.role}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm font-mono text-muted">
                    {login.ipAddress || 'Unknown'}
                  </td>
                  <td className="py-4 px-4">
                    <p className="text-xs font-bold text-ink">{login.device}</p>
                    <p className="text-[10px] text-muted">{login.browser}</p>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                      login.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                    }`}>
                      {login.status}
                    </span>
                  </td>
                </tr>
              ))}
              {localDb.getLoginHistory().length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted">
                    No login history recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-ink">Switch Business or Shop</h3>
            <p className="text-muted">Change the active business profile or shop location</p>
          </div>
          <button
            onClick={onBackToBusiness}
            className="px-6 py-3 bg-slate-900 dark:bg-indigo-600 text-white font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Switch Context
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-2xl text-amber-600 dark:text-amber-400">
            <RefreshCcw className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-ink">Storage & Maintenance</h2>
            <p className="text-muted">Optimize database size and clear non-essential data</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-bg border border-border rounded-2xl space-y-4">
            <h4 className="font-bold text-ink flex items-center gap-2">
              <RefreshCcw className="w-4 h-4 text-indigo-600" />
              Optimize Storage
            </h4>
            <p className="text-sm text-muted">
              Compresses large images and cleans up orphaned data to free up space.
            </p>
            <button
              onClick={async () => {
                await localDb.vacuum();
                showSuccess('Storage optimized successfully');
              }}
              className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md"
            >
              Run Maintenance
            </button>
          </div>

          <div className="p-6 bg-bg border border-border rounded-2xl space-y-4">
            <h4 className="font-bold text-ink flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-600" />
              Clear Non-Essential Data
            </h4>
            <p className="text-sm text-muted">
              Clears login history, alerts, and old logs. Your products and sales will be safe.
            </p>
            <button
              onClick={async () => {
                await removeLocal('dmi_pos_login_history');
                await removeLocal('dmi_pos_alerts');
                await removeLocal('dmi_pos_ledger');
                showSuccess('Logs cleared successfully');
              }}
              className="w-full py-3 border border-rose-200 text-rose-600 font-bold rounded-xl hover:bg-rose-50 transition-all"
            >
              Clear History & Logs
            </button>
          </div>
        </div>
      </div>

      <div className="mt-12 pt-12 border-t border-rose-100 dark:border-rose-900/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-rose-50 dark:bg-rose-900/10 text-rose-600 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-rose-600">Danger Zone</h3>
            <p className="text-xs text-muted font-medium">Irreversible actions for your business</p>
          </div>
        </div>

        <div className="p-6 bg-rose-50/50 dark:bg-rose-900/5 border border-rose-100 dark:border-rose-900/20 rounded-3xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h4 className="font-bold text-ink">Delete Business</h4>
              <p className="text-sm text-muted max-w-md">
                Permanently remove this business and all associated data (shops, products, sales, and customers). This action cannot be undone.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-8 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-rose-500/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              Delete Business
            </button>
          </div>
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteBusiness}
        title="Delete Business?"
        message="Are you sure you want to delete this business? This will permanently remove all associated data (shops, products, sales, and customers). This action is irreversible."
        itemName={businessProfile.name}
      />
    </div>
  );
};
