import React, { useState, useEffect } from 'react';
import { ShieldAlert, CreditCard, RefreshCw, Smartphone, CheckCircle, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../services/masterService';

interface SubscriptionLockScreenProps {
  licenseKey: string;
  expiredDate: string | null;
  onUnlocked: () => void;
}

export const SubscriptionLockScreen: React.FC<SubscriptionLockScreenProps> = ({ licenseKey, expiredDate, onUnlocked }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [mpesaTxCode, setMpesaTxCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyingStatus, setVerifyingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'pay' | 'verifying' | 'success'>('pay');
  const [selectedPlanPrice] = useState(3000); // Standard cloud sync monthly renewal is KES 3,000

  // Quick auto-fill phone if saved before
  useEffect(() => {
    const savedPhone = localStorage.getItem('dmi_client_phone') || '';
    if (savedPhone) {
      setPhoneNumber(savedPhone);
    }
  }, []);

  const triggerStkPush = async () => {
    if (!phoneNumber.trim()) {
      setError('Mobile phone number is required');
      return;
    }
    
    setError(null);
    setIsVerifying(true);
    setStep('verifying');
    setVerifyingStatus('Connecting to Safaricom M-Pesa Payment API...');

    const cleanPhone = phoneNumber.replace(/\+/g, '').replace(/\s/g, '');

    try {
      // 1. Fetch license details from Supabase to grab client ID
      const { data: licData, error: fetchErr } = await supabase
        .from('licenses')
        .select('*')
        .eq('license_key', licenseKey)
        .single();

      if (fetchErr || !licData) {
        throw new Error('Could not identify license record for renewal.');
      }

      setVerifyingStatus(`Sending M-Pesa STK PIN request for KES ${selectedPlanPrice.toLocaleString()} to ${cleanPhone}...`);

      // 2. Call STK endpoint
      const stkResponse = await fetch('/api/mpesa/stkpush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          amount: selectedPlanPrice
        })
      });

      const stkData = await stkResponse.json();
      if (!stkResponse.ok || stkData.error) {
        throw new Error(stkData.error || 'Failed to trigger M-Pesa STK Push renewal');
      }

      const checkoutId = stkData.CheckoutRequestID;
      localStorage.setItem('dmi_client_phone', cleanPhone);

      setVerifyingStatus(`Prompt sent to your phone! Please enter your M-Pesa PIN to renew subscription.`);

      // Update license locally in Supabase to denote pending payment to admin
      await supabase.from('licenses')
        .update({
          payment_status: 'PENDING_PAYMENT',
          payment_phone: cleanPhone,
          mpesa_reference: 'STK_RENEW_WAIT'
        })
        .eq('id', licData.id);

      // Notify alerts
      try {
        await supabase.from('piracy_alerts').insert({
          id: crypto.randomUUID(),
          license_id: licData.id,
          message: `🔄 RENEWAL ATTEMPT: "${licData.client_name}" requested KES 3,000 renewal STK Push on phone ${cleanPhone}.`,
          timestamp: new Date().toISOString()
        });
      } catch (e) {}

      // Start Polling Safaricom Status & watching for manual Database allows
      let isSettled = false;

      // Supabase listener for admin manual allow
      const channel = supabase
        .channel(`renew-approval-watch-${licData.id}`)
        .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'licenses', filter: `id=eq.${licData.id}` }, 
          (payload) => {
            if (payload.new && payload.new.status === 'ACTIVE' && payload.new.expires_at) {
              const revisedExpiry = new Date(payload.new.expires_at);
              if (revisedExpiry > new Date()) {
                isSettled = true;
                cleanup();
                setStep('success');
              }
            }
          }
        )
        .subscribe();

      // Long Polling Safaricom Gateway
      const pollInterval = setInterval(async () => {
        if (isSettled) return;
        try {
          const statusRes = await fetch(`/api/mpesa/status/${checkoutId}`);
          if (statusRes.ok) {
            const txStatus = await statusRes.json();
            if (txStatus.status === 'SUCCESS') {
              isSettled = true;
              cleanup();

              // License renewed for exactly 30 days
              const standardExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

              await supabase.from('licenses').update({
                status: 'ACTIVE',
                payment_status: 'PAID',
                mpesa_reference: txStatus.reference || 'AUTOPAY',
                expires_at: standardExpiry
              }).eq('id', licData.id);

              // Add sales entry
              try {
                await supabase.from('sales').insert({
                  id: crypto.randomUUID(),
                  total: Number(selectedPlanPrice),
                  items: [{ name: 'M-Pesa Subscription Renewal', quantity: 1, price: Number(selectedPlanPrice) }],
                  cashier_id: 'AUTOPAY_API',
                  cashier_name: 'Renewal Gateway',
                  client_name: licData.client_name,
                  payment_method: 'MPESA',
                  mpesa_reference: txStatus.reference || 'AUTOPAY',
                  timestamp: new Date().toISOString()
                });
              } catch (salesErr) {}

              // Notify success
              try {
                await supabase.from('piracy_alerts').insert({
                  id: crypto.randomUUID(),
                  license_id: licData.id,
                  message: `🟢 RENEWED: Client "${licData.client_name}" successfully paid KES 3,000 via M-Pesa. Subscription active until ${new Date(standardExpiry).toLocaleDateString()}.`,
                  timestamp: new Date().toISOString()
                });
              } catch (alertErr) {}

              setStep('success');
            } else if (txStatus.status === 'FAILED') {
              isSettled = true;
              cleanup();
              setError(txStatus.resultDesc || 'M-Pesa payment declined or failed on phone.');
              setStep('pay');
            }
          }
        } catch (pollErr) {
          console.error('Polling failure during renewal:', pollErr);
        }
      }, 3000);

      const timeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          setError('Auto confirmation timed out. Enter transaction details manually below to allow David to verify.');
          setStep('pay');
        }
      }, 120000);

      const cleanup = () => {
        clearInterval(pollInterval);
        clearTimeout(timeout);
        if (channel) supabase.removeChannel(channel);
      };

    } catch (e: any) {
      console.error('Renewal request failed:', e);
      setError(e.message || 'M-Pesa connection timed out.');
      setStep('pay');
    }
  };

  const submitManualReferenceForApproval = async () => {
    if (!mpesaTxCode.trim()) {
      setError('M-Pesa Transaction code is required');
      return;
    }
    
    setError(null);
    setIsVerifying(true);
    setStep('verifying');
    setVerifyingStatus('Submitting receipt code to Master control for validation...');

    const txClean = mpesaTxCode.trim().toUpperCase();

    try {
      const { data: licData, error: fetchErr } = await supabase
        .from('licenses')
        .select('*')
        .eq('license_key', licenseKey)
        .single();

      if (fetchErr || !licData) {
        throw new Error('Could not identify license record.');
      }

      // Submit manual code
      await supabase.from('licenses').update({
        payment_status: 'PENDING_PAYMENT',
        mpesa_reference: txClean,
        payment_phone: phoneNumber || 'MANUAL'
      }).eq('id', licData.id);

      // Alert Developer Panel & send email notification
      try {
        await supabase.from('piracy_alerts').insert({
          id: crypto.randomUUID(),
          license_id: licData.id,
          message: `🚨 REAL-TIME RENEWAL APPROVAL REQUEST: "${licData.client_name}" (${phoneNumber || 'MANUAL'}) submitted code "${txClean}". Target: migichidave09@gmail.com.`,
          timestamp: new Date().toISOString(),
          metadata: {
            is_renewal: true,
            ref_code: txClean,
            client_name: licData.client_name,
            phone: phoneNumber,
            target_email: 'migichidave09@gmail.com'
          }
        });

        await supabase.from('email_notifications').insert({
          id: crypto.randomUUID(),
          recipient: 'migichidave09@gmail.com',
          subject: `🚨 MANUAL RENEWAL APPROVAL REQUEST: ${licData.client_name}`,
          body: `Client: ${licData.client_name}\nPhone: ${phoneNumber || 'N/A'}\nM-Pesa Ref: ${txClean}\nTimestamp: ${new Date().toLocaleString()}\n\nPlease verify in Master Admin panel and click Allow.`,
          status: 'PENDING',
          created_at: new Date().toISOString()
        });
      } catch (err) {}

      setVerifyingStatus('Reference registered! Real-time notification sent to Master Admin & email migichidave09@gmail.com. Awaiting David / DMi support team to confirm ledger and click Allow. Do not close this app.');

      // Watch for updates to status: ACTIVE and expires_at being pushed to future
      const channel = supabase
        .channel(`renew-manual-watch-${licData.id}`)
        .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'licenses', filter: `id=eq.${licData.id}` }, 
          (payload) => {
            if (payload.new && payload.new.status === 'ACTIVE' && payload.new.expires_at) {
              const revisedExpiry = new Date(payload.new.expires_at);
              if (revisedExpiry > new Date()) {
                channel.unsubscribe();
                setStep('success');
              }
            }
          }
        )
        .subscribe();

    } catch (e: any) {
      console.error('Manual renewal submission crashed:', e);
      setError(e.message || 'Could not verify database connection.');
      setStep('pay');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/98 backdrop-blur-md flex items-center justify-center z-[100000] p-6 overflow-y-auto font-sans">
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950/25 opacity-80 pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl p-8 bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
        
        <div className="flex flex-col items-center text-center space-y-6">
          
          {step === 'pay' && (
            <>
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center animate-pulse">
                <ShieldAlert className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-black uppercase tracking-tight text-white">Subscription Renewal Required</h2>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Your monthly licensing subscription ended on{' '}
                  <strong className="text-slate-200">
                    {expiredDate ? new Date(expiredDate).toLocaleDateString() : 'N/A'}
                  </strong>
                  . Please renew to continue using the system ledger terminal.
                </p>
              </div>

              {/* Plan Option Banner */}
              <div className="w-full p-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 flex items-center justify-between text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Plan Option</h4>
                    <p className="text-xs font-bold text-white">Monthly Cloud Sync Extension</p>
                  </div>
                </div>
              </div>

              {/* Form inputs */}
              <div className="w-full space-y-4">
                <div className="text-left">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">M-Pesa Mobile Number</label>
                  <div className="relative">
                    <div className="absolute left-4 top-3.5 text-slate-500 text-xs font-mono font-bold">254</div>
                    <input 
                      type="tel"
                      placeholder="791895709"
                      value={phoneNumber.replace(/^254/, '')}
                      onChange={(e) => setPhoneNumber('254' + e.target.value.replace(/^0+/, '').replace(/\s/g, ''))}
                      className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-sm font-mono font-bold text-white focus:ring-1 focus:ring-indigo-500 outline-none h-11"
                    />
                  </div>
                </div>

                {/* Manual validation */}
                <div className="text-left space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">M-Pesa Transaction Reference Code</label>
                  <input 
                    type="text"
                    placeholder="e.g. SAB4X7R1W8"
                    value={mpesaTxCode}
                    onChange={(e) => setMpesaTxCode(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-mono font-bold text-center uppercase tracking-widest text-indigo-400 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  
                  <button 
                    onClick={submitManualReferenceForApproval}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase text-xs tracking-wider shadow-lg shadow-indigo-500/20"
                  >
                    Paid manually? Submit Reference for Approval
                  </button>
                </div>
              </div>

              {error && (
                <div className="w-full p-3 bg-red-500/15 border border-red-500/20 text-red-500 text-[10px] rounded-xl font-bold uppercase tracking-wide flex items-center justify-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {error}
                </div>
              )}

              {/* Helper guide */}
              <div className="p-3.5 bg-slate-900/40 border border-slate-800 rounded-2xl text-left space-y-1.5 text-[10px] text-slate-400">
                <span className="font-extrabold text-indigo-400">Lipa na M-Pesa option:</span>
                <p>Send KES 3,000 to Till: <b>5331774</b> or directly to David: <b>0791895709</b>, enter the returned transaction reference inside the code field above and hit verification.</p>
              </div>
            </>
          )}

          {step === 'verifying' && (
            <div className="py-12 space-y-6 w-full text-center">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full" />
                <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-black uppercase text-white tracking-widest animate-pulse">Reconciling Ledger</h3>
                <p className="text-xs text-slate-400 bg-slate-900/60 p-4 border border-slate-800 rounded-2xl leading-normal">{verifyingStatus}</p>
              </div>
              
              <button 
                onClick={() => {
                  setStep('pay');
                  setError(null);
                }}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold uppercase text-[9px] tracking-widest rounded-xl transition-colors border border-slate-800"
              >
                Go Back & Retry
              </button>
            </div>
          )}

          {step === 'success' && (
            <div className="py-8 space-y-6 w-full text-center">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-black uppercase tracking-tight text-white">Subscription Unlocked!</h2>
                <p className="text-xs text-slate-400">Your terminal license signature was marked ACTIVE. Enjoy full sync speed for another month.</p>
              </div>

              <button 
                onClick={onUnlocked}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-emerald-500/15"
              >
                Relaunch Terminal System
              </button>
            </div>
          )}

          {/* Footer copyright */}
          <div className="pt-4 border-t border-slate-900 w-full flex justify-between items-center text-[9px] text-slate-500">
            <span className="font-extrabold uppercase tracking-widest">DMi Technologies Kenya License Suite</span>
            <span className="font-medium">V2.4.1 SECURE PORTAL</span>
          </div>

        </div>
      </motion.div>
    </div>
  );
};
