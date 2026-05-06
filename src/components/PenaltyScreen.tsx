import React from 'react';
import { ShieldAlert, Lock, Info, Phone, Mail, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

export const PenaltyScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-red-950 flex items-center justify-center z-[99999] p-6 overflow-y-auto">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#ff1111,transparent_50%)] animate-pulse" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl p-8 bg-black/80 backdrop-blur-3xl border-2 border-red-500 rounded-[3rem] shadow-[0_0_100px_rgba(239,68,68,0.5)] relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />
        
        <div className="flex flex-col items-center text-center space-y-8">
          <div className="w-24 h-24 bg-red-500 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.4)] animate-bounce">
            <ShieldAlert className="w-12 h-12 text-white" />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 text-red-500">
               <AlertTriangle className="w-6 h-6" />
               <h1 className="text-4xl font-black tracking-tighter uppercase">Security Lockdown</h1>
               <AlertTriangle className="w-6 h-6" />
            </div>
            
            <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl">
              <p className="text-red-400 font-bold text-lg uppercase tracking-widest mb-2 italic underline text-center">Unauthorized Copy Detected</p>
              <p className="text-slate-300 text-sm leading-relaxed">
                This system has detected a violation of the <span className="font-bold text-white text-center">DMi Technologies Software Licensing Agreement.</span> 
                Unauthorized distribution, copying, or domain migration is strictly prohibited under Kenyan Copyright Laws.
              </p>
            </div>
          </div>

          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-left space-y-2">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pending Penalty</p>
              <p className="text-2xl font-black text-white">KES 50,000.00</p>
              <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">Immediate payment required</p>
            </div>
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-left flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <Lock className="w-4 h-4 text-red-500" />
                <p className="text-xs font-bold text-slate-400">System State: FATAL LOCK</p>
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Encryption Level: MILITARY GRADE</p>
            </div>
          </div>

          <div className="w-full space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-300">Contact Support to Resolution</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <a href="tel:+254700000000" className="flex items-center justify-center gap-3 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all border border-slate-800">
                <Phone className="w-5 h-5 text-indigo-400" />
                +254 7XX XXX XXX
              </a>
              <a href="mailto:legal@dmitechnologies.co.ke" className="flex items-center justify-center gap-3 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all border border-slate-800">
                <Mail className="w-5 h-5 text-indigo-400" />
                Email Support
              </a>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 w-full flex flex-col items-center gap-2">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">
              © 2026 DMi Technologies Kenya
            </p>
            <div className="flex items-center gap-2 text-[9px] text-slate-600 font-medium">
              <Info className="w-3 h-3" />
              This device signature has been logged and reported to the DMi Master Control.
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
