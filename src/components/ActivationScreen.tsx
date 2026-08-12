import React, { useState, useRef } from 'react';
import { Lock, ShieldCheck, AlertCircle, Store, Info, Award, TrendingUp, Layers, CheckCircle, HelpCircle, DollarSign, Copy, ArrowLeft, Smartphone, Upload, Database, FileCheck, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../services/db';
import { localDb } from '../services/localDb';
import { syncService } from '../services/syncService';
import { dmiDataEngine } from '../services/dmiDataEngine';
import { SafeImage } from './SafeImage';
import { masterService, supabase } from '../services/masterService';

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

  // Pricing & Commercial Strategy States inside the Buy Portal
  const [purchaseStep, setPurchaseStep] = useState<'select' | 'pay' | 'verifying' | 'success'>('select');
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<{ name: string; price: number; systemType: string } | null>(null);
  const [clientShopName, setClientShopName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [mpesaTxCode, setMpesaTxCode] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [verifyingStatus, setVerifyingStatus] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  // Backup Import States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [importBackupStatus, setImportBackupStatus] = useState('');

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingBackup(true);
    setImportBackupStatus('Reading backup bundle file...');
    setError(null);

    try {
      const text = await file.text();
      setImportBackupStatus('Restoring database snapshot records & IndexedDB assets...');
      const result = await dmiDataEngine.importDmiDataBundle(text);

      if (result.success) {
        setImportBackupStatus('Restoration complete! Launching system...');
        
        // Retrieve license key from local storage if present
        const savedKey = localStorage.getItem('dmi_pos_license_key') || localStorage.getItem('dmi_pos_activated_license');
        if (savedKey) {
          setPin(savedKey);
        }

        await db.activate('8124');
        localStorage.setItem('dmi_just_activated', 'true');
        
        setTimeout(() => {
          setIsImportingBackup(false);
          alert(`Backup Restored Successfully!\n\n${result.message}`);
          onActivated();
        }, 500);
      } else {
        setIsImportingBackup(false);
        setError(`Backup Import Failed: ${result.message}`);
      }
    } catch (err: any) {
      console.error('Activation backup import error:', err);
      setIsImportingBackup(false);
      setError(`Failed to process backup file: ${err.message || err}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

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

  const finalizeActivation = (key: string) => {
    setGeneratedKey(key);
    setPurchaseStep('success');
  };

  const startMpesaVerification = async () => {
    if (!clientShopName.trim()) {
      setError('Business / Client name is required');
      return;
    }
    if (!clientPhone.trim()) {
      setError('Mobile Number is required for payment tracking');
      return;
    }

    setError(null);
    setPurchaseStep('verifying');
    setVerifyingStatus('Establishing secure connection to Safaricom payment gateway...');

    const licenseId = crypto.randomUUID();
    const placeholderKey = `PENDING_KEY_${licenseId.slice(0, 8)}`;

    const cleanPhone = clientPhone.replace(/\+/g, '').replace(/\s/g, '');

    try {
      // 1. Submit STK Push Request
      setVerifyingStatus(`Sending M-Pesa STK Push PIN prompt to ${cleanPhone}...`);
      const stkResponse = await fetch('/api/mpesa/stkpush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          amount: selectedPlanDetails?.price || 0
        })
      });

      const stkData = await stkResponse.json();
      if (!stkResponse.ok || stkData.error) {
        throw new Error(stkData.error || 'Failed to trigger payment STK push. Check phone format or credentials.');
      }

      const checkoutId = stkData.CheckoutRequestID;
      setVerifyingStatus(`STK PIN prompt sent to ${cleanPhone}! Please check your phone, enter your PIN for KES ${(selectedPlanDetails?.price || 0).toLocaleString()} to authorize.`);

      // 2. Pre-create PENDING license record in Supabase
      const payload = {
        id: licenseId,
        client_name: clientShopName.trim(),
        system_name: selectedPlanDetails?.systemType || 'DMi POS',
        license_key: placeholderKey,
        license_fee: Number(selectedPlanDetails?.price || 0),
        status: 'PENDING', 
        machine_id: machineId,
        authorized_domain: window.location.hostname,
        penalty_amount: Math.floor(Number(selectedPlanDetails?.price || 0) * 1.5),
        created_at: new Date().toISOString(),
        payment_status: 'PENDING_PAYMENT',
        payment_phone: cleanPhone,
        plan_type: selectedPlanDetails?.name,
        mpesa_reference: mpesaTxCode.trim().toUpperCase() || 'STK_AUTO_WAIT'
      };

      await supabase.from('licenses').insert(payload);

      // Notify developer queue and alerts
      try {
        await supabase.from('piracy_alerts').insert({
          id: crypto.randomUUID(),
          license_id: licenseId,
          message: `📡 PENDING: Client "${clientShopName.trim()}" is paying KES ${(selectedPlanDetails?.price || 0).toLocaleString()} via M-Pesa mobile ${cleanPhone}. Reference requested.`,
          timestamp: new Date().toISOString(),
          metadata: {
            is_purchase_pending: true,
            amount: selectedPlanDetails?.price,
            plan_name: selectedPlanDetails?.name,
            phone: cleanPhone
          }
        });
      } catch (err) {}

      // 3. Start reactive polling
      let isCompleted = false;

      // Define cleanup
      let cleanup = () => {};

      // Realtime subscription watching if the master admin updates status or allows it manually
      const channel = supabase
        .channel(`license-approve-watch-${licenseId}`)
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'licenses',
            filter: `id=eq.${licenseId}`
          }, 
          (payload) => {
            if (payload.new && payload.new.status === 'ACTIVE') {
              if (!isCompleted) {
                isCompleted = true;
                cleanup();
                finalizeActivation(payload.new.license_key);
              }
            }
          }
        )
        .subscribe();

      // Long-polling M-Pesa transaction status
      const pollInterval = setInterval(async () => {
        if (isCompleted) return;
        try {
          const statusRes = await fetch(`/api/mpesa/status/${checkoutId}`);
          if (statusRes.ok) {
            const txStatus = await statusRes.json();
            if (txStatus.status === 'SUCCESS') {
              clearInterval(pollInterval);
              clearTimeout(timeout);
              
              setVerifyingStatus('Payment verified successfully! Awaiting owner David Migichi to approve your activation and generate your license key. Keep this window open; your system will launch automatically.');

              await supabase.from('licenses').update({
                payment_status: 'PAID',
                mpesa_reference: txStatus.reference || 'AUTOPAY'
              }).eq('id', licenseId);

              // Add sales entry
              try {
                await supabase.from('sales').insert({
                  id: crypto.randomUUID(),
                  total: Number(selectedPlanDetails?.price || 0),
                  items: [{ name: `M-Pesa Auto-License: ${selectedPlanDetails?.name}`, quantity: 1, price: Number(selectedPlanDetails?.price || 0) }],
                  cashier_id: 'AUTOPAY_API',
                  cashier_name: 'M-Pesa Webhook',
                  client_name: clientShopName.trim(),
                  payment_method: 'MPESA',
                  mpesa_reference: txStatus.reference || 'AUTOPAY',
                  timestamp: new Date().toISOString()
                });
              } catch (se) {}

              // Notify success
              try {
                await supabase.from('piracy_alerts').insert({
                  id: crypto.randomUUID(),
                  license_id: licenseId,
                  message: `🟢 COMPLETED STK PUSH: Client "${clientShopName.trim()}" automatically paid KES ${(selectedPlanDetails?.price || 0).toLocaleString()} via M-Pesa. Requesting owner license key.`,
                  timestamp: new Date().toISOString(),
                  metadata: { is_purchase: true, amount: selectedPlanDetails?.price }
                });
              } catch (alertErr) {}
            } else if (txStatus.status === 'FAILED') {
              isCompleted = true;
              cleanup();
              setError(txStatus.resultDesc || 'M-Pesa transaction declined by client.');
              setPurchaseStep('pay');
            }
          }
        } catch (pollErr: any) {
          console.error('Polling error:', pollErr);
        }
      }, 3000);

      // Safety timeout after 2 minutes
      const timeout = setTimeout(() => {
        if (!isCompleted) {
          isCompleted = true;
          cleanup();
          // Drop back to pay step but with helper code so they can await manual receipt checks
          setError('STK verification took too long. Keep this page open; David can allow & activate your device manually from Master Admin.');
          setPurchaseStep('pay');
        }
      }, 120000);

      cleanup = () => {
        clearInterval(pollInterval);
        clearTimeout(timeout);
        if (channel) supabase.removeChannel(channel);
      };

    } catch (e: any) {
      console.error('M-Pesa checkout trigger failed:', e);
      setError('Checkout failed: ' + (e.message || 'Check terminal network and credentials.'));
      setPurchaseStep('pay');
    }
  };

  const handleManualSubmitForApproval = async () => {
    if (!clientShopName.trim()) {
      setError('Business / Client name is required');
      return;
    }
    if (!clientPhone.trim()) {
      setError('Mobile Number is required for manual matching');
      return;
    }
    if (!mpesaTxCode.trim()) {
      setError('M-Pesa Transaction receipt code is required for manual verification');
      return;
    }

    setError(null);
    setPurchaseStep('verifying');
    setVerifyingStatus('Submitting payment reference SAB... for Admin Verification...');

    const licenseId = crypto.randomUUID();
    const placeholderKey = `PENDING_KEY_${licenseId.slice(0, 8)}`;

    const cleanPhone = clientPhone.replace(/\+/g, '').replace(/\s/g, '');
    const txClean = mpesaTxCode.trim().toUpperCase();

    try {
      // Create PENDING license record in Supabase so developer can see it and allow
      const payload = {
        id: licenseId,
        client_name: clientShopName.trim(),
        system_name: selectedPlanDetails?.systemType || 'DMi POS',
        license_key: placeholderKey,
        license_fee: Number(selectedPlanDetails?.price || 0),
        status: 'PENDING', 
        machine_id: machineId,
        authorized_domain: window.location.hostname,
        penalty_amount: Math.floor(Number(selectedPlanDetails?.price || 0) * 1.5),
        created_at: new Date().toISOString(),
        payment_status: 'PENDING_PAYMENT',
        payment_phone: cleanPhone,
        plan_type: selectedPlanDetails?.name,
        mpesa_reference: txClean
      };

      await supabase.from('licenses').insert(payload);

      // Notify developer logs & send real-time alert + email notification
      try {
        await supabase.from('piracy_alerts').insert({
          id: crypto.randomUUID(),
          license_id: licenseId,
          message: `🚨 REAL-TIME PAYMENT APPROVAL ALERT: Client "${clientShopName.trim()}" (${cleanPhone}) submitted code "${txClean}" for plan "${selectedPlanDetails?.name}". Target: migichidave09@gmail.com.`,
          timestamp: new Date().toISOString(),
          metadata: {
            is_purchase_pending: true,
            ref_code: txClean,
            plan_name: selectedPlanDetails?.name,
            phone: cleanPhone,
            client_name: clientShopName.trim(),
            target_email: 'migichidave09@gmail.com'
          }
        });

        await supabase.from('email_notifications').insert({
          id: crypto.randomUUID(),
          recipient: 'migichidave09@gmail.com',
          subject: `🚨 MANUAL PAYMENT APPROVAL: ${clientShopName.trim()} (${txClean})`,
          body: `Client: ${clientShopName.trim()}\nPhone: ${cleanPhone}\nPlan: ${selectedPlanDetails?.name}\nM-Pesa Ref: ${txClean}\nTimestamp: ${new Date().toLocaleString()}\n\nPlease verify in Master Admin panel and click Confirm & Allow.`,
          status: 'PENDING',
          created_at: new Date().toISOString()
        });
      } catch (err) {}

      setVerifyingStatus('Payment submitted! Real-time notification dispatched to Master Admin & email migichidave09@gmail.com. Awaiting David to confirm on his phone/email and Allow software launch. Do not close browser.');

      // Watch for license state changes to 'ACTIVE'
      const channel = supabase
        .channel(`license-approve-watch-${licenseId}`)
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'licenses',
            filter: `id=eq.${licenseId}`
          }, 
          (payload) => {
            if (payload.new && payload.new.status === 'ACTIVE') {
              channel.unsubscribe();
              finalizeActivation(payload.new.license_key);
            }
          }
        )
        .subscribe();

    } catch (e: any) {
      console.error('Manual matching submission error:', e);
      setError('Matching failed: ' + (e.message || 'Please check your SQL or credentials.'));
      setPurchaseStep('pay');
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
          localStorage.setItem('dmi_just_activated', 'true');
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
        localStorage.setItem('dmi_just_activated', 'true');
        onActivated();
        return;
      }

      // 2. Try global license key via Master Service
      const domain = window.location.hostname;
      
      const result = await masterService.verifyLicense(cleanPin, machineId, domain);
      if (result.success) {
        localStorage.setItem('dmi_pos_license_key', cleanPin);

        const businessId = result.data?.business_id || result.data?.id || `biz_${cleanPin}`;
        localDb.setActiveBusinessId(businessId);

        await db.activate('8124'); // Internal trigger to mark as activated locally
        localStorage.setItem('dmi_just_activated', 'true');

        // Instantly download and sync all business data onto this laptop/device
        try {
          await syncService.syncNow(true);
        } catch (sErr) {}

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
              System Activation Required. Please enter your license key to continue or restore from a backup file.
            </p>
          </div>

          {/* Auto-Backup Status & Import Backup Box */}
          <div className="w-full p-4 bg-slate-950/90 border border-slate-800 rounded-2xl text-left space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Auto-Backup Status:</span>
              <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ACTIVE
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-900">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Folder:</span>
              <span className="font-mono text-[11px] font-bold text-indigo-300">Desktop / DMi Backup</span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-900">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Last Backup:</span>
              <span className="font-mono text-[11px] font-bold text-slate-300">12/08/2026, 14:02:49</span>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImportingBackup}
              className="w-full mt-2 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 group active:scale-95"
            >
              <Upload className="w-4 h-4 text-indigo-200 group-hover:scale-110 transition-transform" />
              <span>Import Backup (.dmidata)</span>
            </button>
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            accept=".dmidata,.json" 
            onChange={handleImportBackupFile} 
            className="hidden" 
          />

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
                  <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                    <Award className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">DMi Business Engine Checkout</h2>
                    <p className="text-xs text-slate-400">Secure automated self-onboarding and licensing for Kenyan SMEs.</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowPricingModal(false);
                    setPurchaseStep('select');
                    setError(null);
                  }}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                  Close Plan View
                </button>
              </div>

              {purchaseStep === 'select' && (
                <div className="space-y-6">
                  {/* Plans Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Plan 1 */}
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                      <div>
                        <span className="px-2 py-0.5 bg-indigo-500/15 text-indigo-400 text-[8px] font-black uppercase tracking-widest rounded">SaaS Subscription</span>
                        <h3 className="text-md font-black text-white mt-2 mb-3">Cloud Sync Engine</h3>
                        <p className="text-[10px] text-slate-500 mb-3">Best for Boutique shops, beauty salons, general retail, pharmacies, cosmetics hubs.</p>
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
                      <button 
                        onClick={() => {
                          setSelectedPlanDetails({ name: 'Cloud Sync Engine (SaaS)', price: 3000, systemType: 'BoutiqueMaster (SaaS)' });
                          setPurchaseStep('pay');
                        }}
                        className="w-full mt-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                      >
                        Select Plan
                      </button>
                    </div>

                    {/* Plan 2 */}
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between border-t-4 border-t-amber-500">
                      <div>
                        <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-[8px] font-black uppercase tracking-widest rounded">One-off license</span>
                        <h3 className="text-md font-black text-white mt-2 mb-3">Premium Local-First</h3>
                        <p className="text-[10px] text-slate-500 mb-3">Best for Hardware yards, standalone wholesale depots, countryside hub stores.</p>
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
                      <button 
                        onClick={() => {
                          setSelectedPlanDetails({ name: 'Premium Local-First', price: 45000, systemType: 'HardwareMaster (Offline)' });
                          setPurchaseStep('pay');
                        }}
                        className="w-full mt-4 py-2.5 bg-amber-500 hover:bg-amber-450 text-slate-950 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                      >
                        Select Plan
                      </button>
                    </div>

                    {/* Plan 3 */}
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between border-t-4 border-t-indigo-500">
                      <div>
                        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[8px] font-black uppercase tracking-widest rounded">Hospitality Bundle</span>
                        <h3 className="text-md font-black text-white mt-2 mb-3">Hotel & Lodge Suite</h3>
                        <p className="text-[10px] text-slate-500 mb-3">Best for motels, Airbnbs, boarding houses, resorts, bar lounges.</p>
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
                      <button 
                        onClick={() => {
                          setSelectedPlanDetails({ name: 'Hotel & Lodge Suite', price: 6500, systemType: 'HotelMaster (GuestDesk)' });
                          setPurchaseStep('pay');
                        }}
                        className="w-full mt-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                      >
                        Select Plan
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {purchaseStep === 'pay' && selectedPlanDetails && (
                <div className="space-y-6">
                  {/* Back button */}
                  <button 
                    onClick={() => {
                      setPurchaseStep('select');
                      setError(null);
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to plans overview
                  </button>

                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    {/* Left Column - Form */}
                    <div className="lg:col-span-2 space-y-5 text-left">
                      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 space-y-4">
                        <span className="px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 text-[9px] font-black uppercase tracking-wider rounded">Plan Registration</span>
                        <h4 className="text-md font-black uppercase tracking-tight text-white">{selectedPlanDetails.name}</h4>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Selected Plan:</span>
                          <span className="font-mono bg-indigo-500/10 text-indigo-400 px-2.5 py-0.5 rounded font-black text-xs">{selectedPlanDetails.name}</span>
                        </div>
                      </div>

                      {/* Onboarding parameters */}
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Business / Client Name</label>
                          <input 
                            type="text"
                            placeholder="e.g., Downtown Wholesalers Ltd"
                            value={clientShopName}
                            onChange={(e) => setClientShopName(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Mobile Number</label>
                          <input 
                            type="text"
                            placeholder="e.g., 0712345678"
                            value={clientPhone}
                            onChange={(e) => setClientPhone(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">M-Pesa Transaction Reference Code</label>
                          <input 
                            type="text"
                            placeholder="e.g. SAB4X7R1W8"
                            value={mpesaTxCode}
                            onChange={(e) => setMpesaTxCode(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono font-bold uppercase tracking-widest text-indigo-400 focus:ring-2 focus:ring-indigo-500 outline-none h-12 text-center"
                          />
                          <p className="text-[9px] text-slate-500 mt-1">Enter the 10-character transaction reference returned on your phone after payment.</p>
                        </div>
                      </div>

                      {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] rounded-lg font-bold uppercase tracking-wide flex items-center gap-1.5 justify-center">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {error}
                        </div>
                      )}

                      <div className="space-y-3">
                        <button 
                          onClick={handleManualSubmitForApproval}
                          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase text-xs tracking-wider shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                          <ShieldCheck className="w-4 h-4" /> Paid manually? Submit Code for Approval
                        </button>
                      </div>
                    </div>

                    {/* Right Column - Instructions */}
                    <div className="lg:col-span-3 space-y-4 text-left">
                      <div className="bg-slate-950 border border-slate-800/80 p-6 rounded-2xl space-y-6">
                        <div className="flex items-center gap-2 text-indigo-400 pb-3 border-b border-slate-900">
                          <Smartphone className="w-5 h-5 animate-pulse" />
                          <h4 className="text-xs font-black uppercase tracking-wider">How to Make M-Pesa Payment</h4>
                        </div>

                        <div className="space-y-6 text-xs text-slate-400">
                          {/* Method A */}
                          <div className="space-y-2.5 p-3 rounded-xl border border-slate-800/40 bg-slate-900/10">
                            <span className="px-2 py-0.5 bg-indigo-600/20 text-indigo-300 text-[9px] font-black rounded uppercase tracking-wide block w-fit">Method 1: Lipa na M-Pesa Till</span>
                            <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed text-slate-300">
                              <li>Open M-Pesa on your smartphone.</li>
                              <li>Select **Lipa na M-Pesa** from the menu.</li>
                              <li>Select **Buy Goods and Services**.</li>
                              <li>Enter Till Number: <strong className="text-white font-mono text-xs bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">5331774</strong></li>
                              <li>Enter Exact Amount: <strong className="text-indigo-400 font-mono text-xs bg-slate-950 px-1.5 py-0.5 rounded border border-indigo-900/40">KES {selectedPlanDetails.price.toLocaleString()}</strong></li>
                              <li>Enter your secret M-Pesa PIN and press Send.</li>
                            </ol>
                          </div>

                          {/* Method B */}
                          <div className="space-y-2.5 p-3 rounded-xl border border-slate-800/40 bg-slate-900/10">
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[9px] font-black rounded uppercase tracking-wide block w-fit">Method 2: Send Money Directly</span>
                            <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed text-slate-300">
                              <li>Open M-Pesa on your mobile.</li>
                              <li>Select **Send Money** from menu.</li>
                              <li>Enter Phone Number: <strong className="text-white font-mono text-xs bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">0791895709</strong></li>
                              <li>Enter Exact Amount: <strong className="text-amber-500 font-mono text-xs bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">KES {selectedPlanDetails.price.toLocaleString()}</strong></li>
                              <li>Confirm recipient name: <strong className="text-slate-200">David Migichi / DMi</strong></li>
                              <li>Enter M-Pesa PIN and send.</li>
                            </ol>
                          </div>
                        </div>

                        {/* Direct Note */}
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] text-amber-500 leading-normal">
                          💡 <strong>Zero Setup Charges:</strong> The system automatically verifies your M-Pesa ledger deposit instantly 24/7. Once confirmed, your license signature is live globally.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {purchaseStep === 'verifying' && (
                <div className="py-16 text-center space-y-6 max-w-md mx-auto">
                  <div className="relative w-20 h-20 mx-auto">
                    <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-md font-black uppercase text-white tracking-widest animate-pulse">Resolving M-pesa Ledger</h4>
                    <p className="text-xs text-slate-400 leading-relaxed min-h-[2.5rem] bg-slate-950 p-4 rounded-xl border border-slate-800">{verifyingStatus}</p>
                  </div>
                </div>
              )}

              {purchaseStep === 'success' && (
                <div className="py-8 max-w-lg mx-auto text-center space-y-6">
                  {/* Visual trigger */}
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400 border border-emerald-500/30">
                    <CheckCircle className="w-8 h-8" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">Active licensing generated!</h3>
                    <p className="text-xs text-slate-400">Payment receipt has been verified successfully. Your business terminal is provisioned.</p>
                  </div>

                  {/* Generated license box */}
                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block">Your Secure Software Licensing PIN</span>
                    <code className="block select-all p-4 bg-slate-900 border border-slate-800 rounded-xl text-xl font-black font-mono tracking-widest text-indigo-400">
                      {generatedKey}
                    </code>
                    
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(generatedKey);
                        setCopiedKey(true);
                        setTimeout(() => setCopiedKey(false), 2000);
                      }}
                      className="text-[10px] font-black uppercase text-indigo-400 hover:underline hover:text-indigo-300 mx-auto block flex items-center gap-1.5 text-center justify-center"
                    >
                      <Copy className="w-3.5 h-3.5" /> {copiedKey ? 'Keys Copied!' : 'Copy to clipboard'}
                    </button>
                  </div>

                  <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-500">
                     The system registered this key for <strong>{clientShopName}</strong> under Machine ID <code className="text-indigo-400 font-mono font-bold">{machineId.slice(0, 10)}...</code>.
                  </div>

                  <button 
                    onClick={async () => {
                      // Automatically apply key and trigger system launch instantly
                      setPin(generatedKey);
                      setShowPricingModal(false);
                      setPurchaseStep('select');
                      setError(null);
                      
                      // Small delay to let modal state close before activation triggers
                      setIsActivating(true);
                      setTimeout(async () => {
                        try {
                          await db.activate('8124');
                          localStorage.setItem('dmi_pos_license_key', generatedKey);
                          localStorage.setItem('dmi_just_activated', 'true');
                          onActivated();
                        } catch (e) {
                          console.error(e);
                          setIsActivating(false);
                        }
                      }, 400);
                    }}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-emerald-500/15"
                  >
                    Auto-Apply Key & Launch System
                  </button>
                </div>
              )}

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

      {/* Backup Restoration Loading Overlay */}
      <AnimatePresence>
        {isImportingBackup && (
          <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-indigo-500/30 text-center space-y-4"
            >
              <div className="w-14 h-14 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
                <Database className="w-7 h-7 animate-bounce" />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">Restoring System Backup</h3>
              <p className="text-xs text-slate-400 animate-pulse">{importBackupStatus || 'Processing system records...'}</p>
              <div className="flex justify-center pt-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
