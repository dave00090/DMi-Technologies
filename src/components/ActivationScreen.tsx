import React, { useState } from 'react';
import { Lock, ShieldCheck, AlertCircle, Store, Info, Award, TrendingUp, Layers, CheckCircle, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../services/db';
import { SafeImage } from './SafeImage';
import { masterService } from '../services/masterService';

import { SYSTEM_LOGO_URL } from '../constants';

interface ActivationScreenProps {
  onActivated: () => void;
  onMasterLogin: () => void;
}

export const ActivationScreen: React.FC<ActivationScreenProps> = ({ onActivated, onMasterLogin }) => {
  const [pin, setPin] = useState('');
  const [offlineCode, setOfflineCode] = useState('');
  const [showOffline, setShowOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);

  const [clickCount, setClickCount] = useState(0);

  const machineId = btoa(navigator.userAgent + screen.width + screen.height).slice(0, 32);

  const handleLogoClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount >= 5) {
      onMasterLogin();
      setClickCount(0);
    }
  };

  const handleActivate = async () => {
    setIsActivating(true);
    setError(null);
    const cleanPin = pin.trim();

    try {
      if (showOffline) {
        const expected = masterService.generateOfflineResponse(machineId, 'DMI_OFFLINE_SECRET_2026');
        if (offlineCode.trim() === expected) {
          await db.activate('8124');
          onActivated();
          return;
        } else {
          setError('Invalid Offline Activation Code');
          setIsActivating(false);
          return;
        }
      }

      // 1. Try local master PIN (for developer override)
      const success = await db.activate(cleanPin);
      if (success) {
        onActivated();
        return;
      }

      // 2. Try global license key via Master Service
      const domain = window.location.hostname;
      
      const result = await masterService.verifyLicense(cleanPin, machineId, domain);
      if (result.success) {
        localStorage.setItem('dmi_pos_license_key', cleanPin);
        await db.activate('8124'); // Internal trigger to mark as activated locally
        onActivated();
      } else {
        setError(result.message || 'Invalid Activation PIN or License Key');
        setIsActivating(false);
      }
    } catch (err) {
      console.error('Activation error:', err);
      setError('Connection to License Server Failed');
      setIsActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-[9999]">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#4f46e5,transparent_50%)]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-8 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
        
        <div className="flex flex-col items-center text-center space-y-6">
          <div 
            onClick={handleLogoClick}
            className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 overflow-hidden border border-slate-800 shadow-xl cursor-pointer active:scale-95 transition-transform"
          >
            <SafeImage 
              src={SYSTEM_LOGO_URL} 
              alt="Logo" 
              className="w-full h-full object-contain p-3" 
              fallback={<Store className="w-10 h-10 text-slate-300" />}
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white tracking-tight uppercase">DMi Technologies</h1>
            <p className="text-slate-400 text-sm font-medium">
              System Activation Required. Please enter your license key to continue.
            </p>
          </div>

          <div className="w-full space-y-4">
            <div className="relative">
              {!showOffline ? (
                <input
                  type="text"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                  placeholder="License Key / PIN"
                  className={`w-full px-6 py-4 bg-slate-950 border ${error ? 'border-red-500' : 'border-slate-800'} rounded-2xl text-center text-lg font-bold tracking-wider text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-700 placeholder:tracking-normal placeholder:text-sm`}
                />
              ) : (
                <div className="space-y-4 text-left">
                  <div className="p-4 bg-slate-100 dark:bg-slate-950 border border-slate-800 rounded-xl">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Your Machine ID (Share with Developer)</p>
                    <code className="text-xs text-indigo-400 break-all">{machineId}</code>
                  </div>
                  <input
                    type="text"
                    value={offlineCode}
                    onChange={(e) => setOfflineCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                    placeholder="Enter Offline Response Code"
                    className={`w-full px-6 py-4 bg-slate-950 border ${error ? 'border-red-500' : 'border-slate-800'} rounded-2xl text-center text-lg font-bold tracking-wider text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-700 placeholder:tracking-normal placeholder:text-sm`}
                  />
                </div>
              )}
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-2 mt-2 text-red-500 text-xs font-bold uppercase tracking-widest"
                >
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </motion.div>
              )}
            </div>

            <button
              onClick={handleActivate}
              disabled={isActivating || (showOffline ? !offlineCode : !pin)}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-3"
            >
              {isActivating ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  {showOffline ? 'Verify Offline Key' : 'Activate System'}
                </>
              )}
            </button>

            <button 
              onClick={() => {
                setShowOffline(!showOffline);
                setError(null);
              }}
              className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-indigo-400 transition-colors mx-auto block"
            >
              {showOffline ? 'Back to Online Activation' : 'I am Offline (Manual Activation)'}
            </button>

            <button 
              onClick={() => setShowPricingModal(true)}
              className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 hover:underline transition-all mx-auto block mt-4 flex items-center justify-center gap-1.5"
              id="activate-explore-plans-btn"
            >
              <Award className="w-3.5 h-3.5 animate-pulse" />
              Explore Pricing Plans & 7-Day Demo
            </button>
          </div>

          <div className="pt-6 border-t border-slate-800 w-full space-y-4">
            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              <Info className="w-3.5 h-3.5" />
              Legal: Software Protected by Kenya Copyright Law
            </div>
            <p className="text-[9px] text-slate-600 font-medium">
              By activating, you agree to the licensing terms of DMi Technologies. Unauthorized redistribution will result in system lock and penalty.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Pricing Modal Pop-up */}
      <AnimatePresence>
        {showPricingModal && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[10000] p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-[2rem] p-8 space-y-6 relative max-h-[90vh] overflow-y-auto"
            >
              {/* Target Header */}
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                    <Award className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">DMi Business Engine Licensing</h2>
                    <p className="text-xs text-slate-400">Official standard commercial tiers optimized for Kenyan SMEs and merchants.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPricingModal(false)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                  Close Plan View
                </button>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Plan 1 */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="px-2 py-0.5 bg-indigo-500/15 text-indigo-400 text-[8px] font-black uppercase tracking-widest rounded">SaaS Subscription</span>
                    <h3 className="text-md font-black text-white mt-2 mb-1">Cloud Sync Engine</h3>
                    <p className="text-[10px] text-slate-500 mb-3">Best for Boutique shops, beauty salons, general retail, pharmacies, cosmetics hubs.</p>
                    <div className="text-lg font-black text-indigo-400 mb-4 font-sans">
                      KES 2,500 - 4,000 <span className="text-[10px] text-slate-500 font-normal">/ month</span>
                    </div>
                    <ul className="text-[10px] text-slate-400 space-y-2">
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-400 font-black">✓</span>
                        <span><b>Auto Cloud Sync</b>: Real-time cloud database backup.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-400 font-black">✓</span>
                        <span><b>Live Alerts</b>: WhatsApp integration for low-stock logs.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-400 font-black">✓</span>
                        <span><b>Owner Dashboard</b>: Track live shop sales remotely on any mobile browser.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Plan 2 */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between border-t-4 border-t-amber-500">
                  <div>
                    <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-[8px] font-black uppercase tracking-widest rounded">One-off license</span>
                    <h3 className="text-md font-black text-white mt-2 mb-1">Premium Local-First</h3>
                    <p className="text-[10px] text-slate-500 mb-3">Best for Hardware yards, standalone wholesale depots, countryside hub stores.</p>
                    <div className="text-lg font-black text-amber-500 mb-4 font-sans">
                      KES 35,000 - 55,000 <span className="text-[10px] text-slate-500 font-normal">One-Off</span>
                    </div>
                    <ul className="text-[10px] text-slate-400 space-y-2">
                      <li className="flex items-start gap-1.5">
                        <span className="text-amber-500 font-black">✓</span>
                        <span><b>True Offline Mode</b>: Functions with 100% cloud independence.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-amber-500 font-black">✓</span>
                        <span><b>Physical Install</b>: Set up on owner computer with custom receipt parameters.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-amber-500 font-black">✓</span>
                        <span><b>Inclusive Cover</b>: Includes 1 Full Year premium offline support.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Plan 3 */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between border-t-4 border-t-indigo-500">
                  <div>
                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[8px] font-black uppercase tracking-widest rounded">Hospitality Bundle</span>
                    <h3 className="text-md font-black text-white mt-2 mb-1">Hotel & Lodge Suite</h3>
                    <p className="text-[10px] text-slate-500 mb-3">Best for motels, Airbnbs, boarding houses, resorts, bar lounges.</p>
                    <div className="text-lg font-black text-indigo-400 mb-4 font-sans">
                      KES 5,000 - 8,000 <span className="text-[10px] text-slate-400">/ mo</span> or <span className="text-indigo-300">80K</span> once
                    </div>
                    <ul className="text-[10px] text-slate-400 space-y-2">
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-400 font-black">✓</span>
                        <span><b>Central Guest Desk</b>: Integrated front-office register & billing logs.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-400 font-black">✓</span>
                        <span><b>Client Guest Portal</b>: Guests scan QR on room walls to order/check tabs.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-400 font-black">✓</span>
                        <span><b>Dual Database Sync</b>: Perfect hybrid offline POS with live cloud query models.</span>
                      </li>
                    </ul>
                  </div>
                </div>

              </div>

              {/* Zero Down Trial Info */}
              <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <HelpCircle className="w-24 h-24 text-white" />
                </div>
                <div className="flex items-center gap-2 text-indigo-400">
                  <TrendingUp className="w-5 h-5 animate-bounce" />
                  <h4 className="text-xs font-black uppercase tracking-wider">The 7-Day Live Trial (Zero-Down Trial Protection)</h4>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  We install fully functional versions of DMi POS on your PC/hardware free for exactly <b>7 days</b>.
                  This lets you track stock levels, inventory audits, and daily staff profit leakage without spending a cent. 
                  Once we prove the leaks stop and efficiency goes up, choosing your activation package is easy!
                </p>
              </div>

              {/* CTA Support Desk */}
              <div className="pt-4 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-bold text-slate-500">
                <p className="text-center md:text-left text-[11px]">
                  Ready to buy a key or schedule a free installation? Contact support with your <b>Machine ID:</b> <code className="text-emerald-400 font-mono font-bold bg-slate-950 px-2 py-1 rounded border border-slate-800/80">{machineId.slice(0, 12)}...</code>
                </p>
                <div className="flex gap-3">
                  <a 
                    href="mailto:support@dmitech.co.ke?subject=DMi%20POS%20License%20Activation"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-500/15"
                  >
                    Email activations desk
                  </a>
                  <button 
                    onClick={() => setShowPricingModal(false)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-colors"
                  >
                    Alright, close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
