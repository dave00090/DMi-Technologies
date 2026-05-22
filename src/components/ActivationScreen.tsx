import React, { useState } from 'react';
import { Lock, ShieldCheck, AlertCircle, Store, Info } from 'lucide-react';
import { motion } from 'motion/react';
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
    </div>
  );
};
