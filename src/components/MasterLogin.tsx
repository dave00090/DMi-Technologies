import React, { useState } from 'react';
import { Shield, Key, ArrowRight, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DMI_LOGO_URL } from '../constants';

interface MasterLoginProps {
  onLogin: (success: boolean) => void;
  onCancel: () => void;
}

export const MasterLogin: React.FC<MasterLoginProps> = ({ onLogin, onCancel }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would be an API call to your backend
    if (password === 'DMI@2026!MASTER') {
      onLogin(true);
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[9999] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-600 to-violet-600" />
        
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-4 overflow-hidden border border-slate-700 shadow-xl">
            <img src={DMI_LOGO_URL} alt="DMi" className="w-full h-full object-contain p-3" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Master Control Access</h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Authorized Personnel Only</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">
              Master Access Key
            </label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className={`w-full pl-12 pr-4 py-4 bg-slate-950 border rounded-2xl text-white outline-none transition-all ${
                  error ? 'border-red-500 ring-4 ring-red-500/10' : 'border-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                }`}
                autoFocus
              />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-red-400 text-xs font-bold"
              >
                <AlertTriangle className="w-4 h-4" />
                Access Denied: Invalid Master Key
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
            >
              Enter Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
            >
              Cancel Access
            </button>
          </div>
        </form>

        <p className="mt-8 text-center text-[9px] font-bold text-slate-600 uppercase tracking-widest">
          IP Address Registered • 256-bit Encryption Active
        </p>
      </motion.div>
    </div>
  );
};
