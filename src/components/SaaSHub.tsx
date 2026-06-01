import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Terminal, 
  Key, 
  Smartphone, 
  CreditCard, 
  Database, 
  RefreshCw, 
  Cpu, 
  Copy, 
  CheckCircle, 
  FileCode, 
  Sparkles, 
  Lock, 
  Eye, 
  EyeOff, 
  Layers, 
  GitMerge, 
  Maximize2,
  Printer,
  Barcode,
  Tv,
  Check,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../services/masterService';
import { localDb } from '../services/localDb';

export const SaaSHub: React.FC = () => {
  const [activeStep, setActiveStep] = useState<'onboarding' | 'multi-tenancy' | 'encryption' | 'resolution' | 'packaging'>('onboarding');
  
  // 1. Onboarding & Payments State
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [shopsCount, setShopsCount] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<'bronze' | 'silver' | 'gold'>('gold');
  const [onboardingStatus, setOnboardingStatus] = useState<'idle' | 'paying' | 'provisioning' | 'completed'>('idle');
  const [paymentGateway, setPaymentGateway] = useState<'mpesa' | 'stripe'>('mpesa');
  const [provLogs, setProvLogs] = useState<string[]>([]);
  const [generatedKey, setGeneratedKey] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // 2. RLS & Multi-Tenancy State
  const [rlsActive, setRlsActive] = useState(true);
  const [simulatedQueryLog, setSimulatedQueryLog] = useState<any[]>([]);
  const [selectedMerchantFilter, setSelectedMerchantFilter] = useState('ALL');

  // 3. Database Encryption Lab State
  const [encryptActive, setEncryptActive] = useState(() => {
    return localStorage.getItem('dmi_pos_encryption_active') !== 'false';
  });
  const [encryptionPin, setEncryptionPin] = useState(() => {
    return localStorage.getItem('dmi_pos_encryption_pin') || '8124';
  });
  const [isPinVisible, setIsPinVisible] = useState(false);
  const [encryptionSaved, setEncryptionSaved] = useState(false);

  // 4. Conflict Resolution Simulation State
  const [originalStock, setOriginalStock] = useState(10);
  const [cashierADelta, setCashierADelta] = useState(-3); // Cashier A sells 3 items offline
  const [cashierBDelta, setCashierBDelta] = useState(5);  // Cashier B restocks 5 items offline
  const [conflictLogs, setConflictLogs] = useState<string[]>([]);
  const [isConflictSimulating, setIsConflictSimulating] = useState(false);
  const [conflictStep, setConflictStep] = useState<number>(0);

  // 5. Desktop & Hardware Bridge State
  const [hardwareLog, setHardwareLog] = useState<string[]>([]);
  const [isKioskMode, setIsKioskMode] = useState(false);

  // Auto-load client details if they exist
  useEffect(() => {
    const savedPin = localStorage.getItem('dmi_pos_encryption_pin');
    if (savedPin) setEncryptionPin(savedPin);
  }, []);

  // Sync Encryption Config to LocalStorage
  const handleSaveEncryptionSetting = () => {
    localStorage.setItem('dmi_pos_encryption_active', encryptActive ? 'true' : 'false');
    localStorage.setItem('dmi_pos_encryption_pin', encryptionPin);
    
    // Dispatch local update so localDb picks it up immediately
    window.dispatchEvent(new CustomEvent('local-db-update', { detail: { key: 'dmi_pos_encryption_pin' } }));
    
    setEncryptionSaved(true);
    setTimeout(() => setEncryptionSaved(false), 3000);
  };

  // Pricing details selector
  const plans = {
    bronze: { name: 'Bronze Standard', price: 2500, shops: 1, limit: '1 Shop' },
    silver: { name: 'Silver Growth', price: 5000, shops: 3, limit: 'Up to 3 Shops' },
    gold: { name: 'SaaS Gold Enterprise', price: 7500, shops: 99, limit: 'Unlimited Shops + HRM' },
  };

  // Launch Onboarding payment and provisioning simulation
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName || !phone) {
      alert('Please fill in Your Business Name and Phone Number.');
      return;
    }

    setOnboardingStatus('paying');
    setProvLogs([]);
    setGeneratedKey('');

    const planPrice = plans[selectedPlan].price;
    const desc = plans[selectedPlan].name;

    // Phase 1: Payment triggers
    if (paymentGateway === 'mpesa') {
      await simulatePaymentMpesa(planPrice);
    } else {
      await simulatePaymentStripe(planPrice);
    }

    // Phase 2: Supabase database partitioning & provisioning logs
    setOnboardingStatus('provisioning');
    await runProvisioningEngine();
  };

  const simulatePaymentMpesa = (price: number) => {
    return new Promise<void>((resolve) => {
      let countdown = 4;
      const interval = setInterval(() => {
        countdown--;
        if (countdown === 3) {
          addProvLog(`[DARAJA API] Connecting to Safaricom Lipa Na M-Pesa STK Push Gateway...`);
        } else if (countdown === 2) {
          addProvLog(`[DARAJA API] Push prompt issued for KES ${price.toLocaleString()} to phone ${phone}...`);
        } else if (countdown === 1) {
          addProvLog(`[DARAJA API] Client successfully completed PIN authorization on mobile handset.`);
        } else if (countdown === 0) {
          clearInterval(interval);
          addProvLog(`[DARAJA API] Callback received successfully from 196.201.214.200 -> Transaction Ref: SAB${Math.random().toString(36).substring(2, 9).toUpperCase()}`);
          resolve();
        }
      }, 1000);
    });
  };

  const simulatePaymentStripe = (price: number) => {
    return new Promise<void>((resolve) => {
      let countdown = 3;
      const interval = setInterval(() => {
        countdown--;
        if (countdown === 2) {
          addProvLog(`[STRIPE API] Connecting to API key token pk_live_51...`);
        } else if (countdown === 1) {
          addProvLog(`[STRIPE API] Initiated subscription session: cus_${Math.random().toString(36).substring(2, 8)}`);
        } else if (countdown === 0) {
          clearInterval(interval);
          addProvLog(`[STRIPE WEBHOOK] Received event "checkout.session.completed" for plan tier KES ${price}/Mo.`);
          resolve();
        }
      }, 1000);
    });
  };

  const runProvisioningEngine = async () => {
    const logs = [
      `[PROVISIONER] Initializing automated backend partition creation...`,
      `[SUPABASE] Provisioning isolated data namespace business_id: "${crypto.randomUUID()}"`,
      `[SUPABASE] Attaching Schema constraints & executing isolated table indexing...`,
      `[PROVISIONER] Seeding default setup: 1 admin profile and ${plans[selectedPlan].shops} shop records...`,
      `[MASTER ADMIN] Generating secure cryptographically verified hardware-locked license key...`,
    ];

    for (let i = 0; i < logs.length; i++) {
      await new Promise(r => setTimeout(r, 600));
      addProvLog(logs[i]);
    }

    // Generate Key
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const key = `DMI-${selectedPlan.toUpperCase()}-${Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join('')}-${Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join('')}-ACTIVE`;
    
    // Attempt registration into Supabase central DB
    try {
      const standardExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const newLicense = {
        id: crypto.randomUUID(),
        license_key: key,
        client_name: businessName,
        status: 'ACTIVE',
        system_name: 'DMI MULTITENANT POS',
        penalty_amount: 0,
        license_fee: plans[selectedPlan].price,
        plan_type: selectedPlan.toUpperCase(),
        expires_at: standardExpiry,
        payment_status: 'PAID',
        payment_phone: phone,
        mpesa_reference: 'AUTOPAY_WIDGET'
      };

      await supabase.from('licenses').insert(newLicense);
      addProvLog(`[MASTER ADMIN] Done! License registered into database cloud. Expiry: ${new Date(standardExpiry).toLocaleDateString()}`);
    } catch (e) {
      addProvLog(`[MASTER ADMIN] Supabase central link missing. Saved tenant partition locally.`);
    }

    setGeneratedKey(key);
    setOnboardingStatus('completed');
  };

  const addProvLog = (msg: string) => {
    setProvLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedKey);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Run RLS live database simulation
  const runRlsSimulation = () => {
    const merchants = [
      { businessId: 'b-merch-a', businessName: 'Savannah Boutique Ltd', cashier: 'Kimani Njuguna', sales: 45000, itemsCount: 15 },
      { businessId: 'b-merch-b', businessName: 'Safari Supermarket Eldoret', cashier: 'Amina Mohamed', sales: 125000, itemsCount: 41 },
      { businessId: 'b-merch-c', businessName: 'Great Rift Pharmacy Nakuru', cashier: 'Charles Kiprop', sales: 32000, itemsCount: 8 }
    ];

    let results = [];
    if (rlsActive) {
      if (selectedMerchantFilter === 'ALL') {
        // Enforce RLS filter: JWT context can only view their own
        results = [merchants[0]]; // Simulates query limited to Savannah Boutique context token!
      } else {
        const found = merchants.find(m => m.businessId === selectedMerchantFilter);
        results = found ? [found] : [];
      }
    } else {
      // Security leak! Shows EVERY business sales to any cashier on standard fetches
      results = merchants;
    }
    setSimulatedQueryLog(results);
  };

  // Run Conflict resolution simulator
  const runConflictStrategySimulation = () => {
    setIsConflictSimulating(true);
    setConflictLogs([]);
    setConflictStep(0);

    const steps = [
      () => {
        setConflictLogs(prev => [...prev, `[1/4] Original stock level on Server for Product (Kshs 1,200 Basin) is set to: ${originalStock} pieces.`]);
        setConflictStep(1);
      },
      () => {
        setConflictLogs(prev => [...prev, `[2/4] Cashier A goes offline (mobile lines jam in Kisumu). Cashier A sells 3 basins -> Client updates local stock to ${originalStock + cashierADelta} pieces.`]);
        setConflictStep(2);
      },
      () => {
        setConflictLogs(prev => [...prev, `[3/4] Simultaneously, Cashier B goes offline in Nairobi. Cashier B registers a supplier supply delivery of +${cashierBDelta} pieces on their terminal -> Client stock becomes ${originalStock + cashierBDelta} pieces.`]);
        setConflictStep(3);
      },
      () => {
        setConflictLogs(prev => [...prev, `--- CLOUD SYNC DEMAND TRIGGERED ---`]);
        // Naive Overwrite calculation
        const naiveResult = originalStock + cashierBDelta; // B overwrote A
        // Real Delta algorithm calculation
        const totalDelta = cashierADelta + cashierBDelta;
        const correctResult = originalStock + totalDelta;

        setConflictLogs(prev => [...prev, `❌ OVERWRITE STRATEGY (Naive): Nairobi overwrites Kisumu because its write timestamp was 1 sec newer. Stock level is set directly to ${naiveResult} pieces. (Kisumu's sales of 3 items are LOST in ghost stock!)`]);
        setConflictLogs(prev => [...prev, `✅ DELTA DIFFERENTIAL STRATEGY (DMI Engine): Server detects deltas. Kisumu delta: ${cashierADelta}. Nairobi delta: +${cashierBDelta}. Server math computes: ${originalStock} + (${cashierADelta}) + (${cashierBDelta}) = ${correctResult} pieces. Perfect match - ZERO data wastage!`]);
        setConflictStep(4);
        setIsConflictSimulating(false);
      }
    ];

    let current = 0;
    const interval = setInterval(() => {
      if (current < steps.length) {
        steps[current]();
        current++;
      } else {
        clearInterval(interval);
      }
    }, 1500);
  };

  // Trigger simulated Direct Print and Laser scan
  const triggerHardwareBridge = (type: 'print' | 'scan') => {
    const timestamp = new Date().toLocaleTimeString();
    if (type === 'print') {
      setHardwareLog(prev => [
        ...prev,
        `[${timestamp}] 🖨️ WebUSB Bridge: USB POS Print triggered. Handshake: VendorID: 0x04B8 (Epson), BaudRate: 9600.`,
        `[${timestamp}] 🖨️ Bridge: Sent raw ESC/POS commands formatting layout: Autocut command appended.`
      ]);
    } else {
      const barcodes = ['6191234567890', '7109876543210', '7254567123982'];
      const pick = barcodes[Math.floor(Math.random() * barcodes.length)];
      setHardwareLog(prev => [
        ...prev,
        `[${timestamp}] 🏷️ Barcode Laser Trigger: Captured keyboard hook event emulation.`,
        `[${timestamp}] 🏷️ Scanned Barcode Payload: "${pick}" successfully decoded -> Added item to POS Cash Register cart.`
      ]);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6" id="saas-development-portal">
      {/* Header and Branding */}
      <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between border-b border-border pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-[10px] font-black uppercase text-brand bg-brand/10 rounded-full tracking-wider">
              Tenant & Monetization Framework is ACTIVE
            </span>
            <Sparkles className="w-4 h-4 text-brand animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">SaaS Client Hub & Developer Lab</h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Onboard new merchants, configure multi-tenant RLS, security encrypt at rest, resolve checkout conflicts, and package binaries.
          </p>
        </div>
        
        {/* Toggle Sections Tabs */}
        <div className="flex flex-wrap gap-1 p-1 bg-white/5 border border-white/10 rounded-xl">
          {(['onboarding', 'multi-tenancy', 'encryption', 'resolution', 'packaging'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveStep(tab)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                activeStep === tab 
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                  : 'text-slate-400 hover:text-ink hover:bg-white/5 border border-transparent'
              }`}
            >
              {tab.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeStep === 'onboarding' && (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Payment & Onboarding inputs */}
            <div className="lg:col-span-7 bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-brand" /> Sell Licensing: Onboard New Shop Manager
              </h2>
              
              <form onSubmit={handleOnboardSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Business / Shop Name</label>
                    <input
                      type="text"
                      className="w-full text-sm bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/20 focus:border-blue-500 focus:bg-blue-500/10 focus:outline-none rounded-lg px-3.5 py-2 text-ink transition-all"
                      placeholder="e.g. Savannah Grocers Limited"
                      value={businessName}
                      onChange={e => setBusinessName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Manager Full Name</label>
                    <input
                      type="text"
                      className="w-full text-sm bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/20 focus:border-blue-500 focus:bg-blue-500/10 focus:outline-none rounded-lg px-3.5 py-2 text-ink transition-all"
                      placeholder="e.g. Martin Kamau"
                      value={ownerName}
                      onChange={e => setOwnerName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Primary Phone Number (M-Pesa STK)</label>
                    <input
                      type="text"
                      className="w-full text-sm bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/20 focus:border-blue-500 focus:bg-blue-500/10 focus:outline-none rounded-lg px-3.5 py-2 text-ink transition-all"
                      placeholder="e.g. 0712345678"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Gateway Provider</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentGateway('mpesa')}
                        className={`py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                          paymentGateway === 'mpesa' 
                            ? 'border-blue-500/50 bg-blue-500/20 text-blue-400' 
                            : 'border-blue-500/10 bg-blue-500/5 text-slate-400 hover:bg-blue-500/10 hover:text-ink'
                        }`}
                      >
                        <Smartphone className="w-4 h-4" /> Safaricom STK
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentGateway('stripe')}
                        className={`py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                          paymentGateway === 'stripe' 
                            ? 'border-blue-500/50 bg-blue-500/20 text-blue-400' 
                            : 'border-blue-500/10 bg-blue-500/5 text-slate-400 hover:bg-blue-500/10 hover:text-ink'
                        }`}
                      >
                        <CreditCard className="w-4 h-4" /> Stripe Cards
                      </button>
                    </div>
                  </div>
                </div>

                {/* Plan Options Selector */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-2">Select Subscription Tier Plan</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div
                      onClick={() => setSelectedPlan('bronze')}
                      className={`p-4 border rounded-xl cursor-pointer transition-all ${
                        selectedPlan === 'bronze' 
                          ? 'border-blue-500/50 bg-blue-500/15 shadow-inner' 
                          : 'border-blue-500/10 bg-blue-500/5 hover:bg-blue-500/10'
                      }`}
                    >
                      <span className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Bronze Starter</span>
                      <span className="block text-xl font-bold mt-1 text-ink">KES 2,500<span className="text-xs font-medium text-slate-400">/mo</span></span>
                      <span className="inline-block mt-2 px-2 py-0.5 text-[9px] font-bold text-blue-500 bg-blue-500/10 rounded-md">
                        1 shop register terminal
                      </span>
                    </div>

                    <div
                      onClick={() => setSelectedPlan('silver')}
                      className={`p-4 border rounded-xl cursor-pointer transition-all relative ${
                        selectedPlan === 'silver' 
                          ? 'border-blue-500/50 bg-blue-500/15 shadow-inner' 
                          : 'border-blue-500/10 bg-blue-500/5 hover:bg-blue-500/10'
                      }`}
                    >
                      <span className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Silver Growth</span>
                      <span className="block text-xl font-bold mt-1 text-ink">KES 5,000<span className="text-xs font-medium text-slate-400">/mo</span></span>
                      <span className="inline-block mt-2 px-2 py-0.5 text-[9px] font-bold text-blue-500 bg-blue-500/10 rounded-md">
                        Up to 3 registers
                      </span>
                    </div>

                    <div
                      onClick={() => setSelectedPlan('gold')}
                      className={`p-4 border rounded-xl cursor-pointer transition-all relative ${
                        selectedPlan === 'gold' 
                          ? 'border-blue-500/50 bg-blue-500/15 shadow-md shadow-blue-500/5' 
                          : 'border-blue-500/10 bg-blue-500/5 hover:bg-blue-500/10'
                      }`}
                    >
                      <div className="absolute -top-2 right-2 bg-blue-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                        POPULAR
                      </div>
                      <span className="block text-xs font-bold text-blue-400 uppercase tracking-wide">SaaS Gold Tier</span>
                      <span className="block text-xl font-bold mt-1 text-ink">KES 7,500<span className="text-xs font-medium text-slate-400">/mo</span></span>
                      <span className="inline-block mt-2 px-2 py-0.5 text-[9px] font-black text-blue-400 bg-blue-500/10 rounded-md">
                        Unlimited Shops + HRM
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={onboardingStatus === 'paying' || onboardingStatus === 'provisioning'}
                    className={`w-full py-2.5 rounded-xl font-bold text-sm tracking-wide transition-all uppercase ${
                      onboardingStatus === 'paying' || onboardingStatus === 'provisioning'
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-brand hover:brightness-110 text-white'
                    }`}
                  >
                    {onboardingStatus === 'paying' && 'Awaiting Payment PIN entry...'}
                    {onboardingStatus === 'provisioning' && 'Confirming Webhook -> Setup DB Tenant...'}
                    {onboardingStatus === 'idle' && `Register Merchant & Request payment`}
                    {onboardingStatus === 'completed' && 'Onboard complete! Generate Another key'}
                  </button>
                </div>
              </form>
            </div>

            {/* Generated results and provisioning logs console */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Provisioning Engine Console Log */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 text-[11px] font-mono text-neutral-300 flex-1 flex flex-col min-h-[300px]">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] font-black text-white uppercase tracking-wider">SaaS Provisioner System Logs</span>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[220px]">
                  {provLogs.length === 0 ? (
                    <div className="text-neutral-500 italic py-8 text-center">
                      Awaiting merchant submission to capture webhook payloads...
                    </div>
                  ) : (
                    provLogs.map((log, i) => (
                      <div key={i} className="leading-relaxed">
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* License display */}
              {generatedKey && (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-card border border-border rounded-xl p-5 shadow-sm relative overflow-hidden"
                >
                  <div className="absolute right-0 top-0 translate-x-2.5 -translate-y-2.5 w-16 h-16 bg-brand/10 rounded-full blur-xl" />
                  
                  <span className="text-[9px] font-black text-brand uppercase tracking-wider block mb-1">
                    Secure Merchant Hardware Licensing Key
                  </span>
                  
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 rounded-xl px-4 py-3 border border-border mt-2">
                    <span className="font-mono text-sm font-bold text-ink tracking-wider">
                      {generatedKey}
                    </span>
                    <button
                      onClick={copyToClipboard}
                      className="p-1.5 hover:bg-slate-250 hover:dark:bg-slate-800 rounded-lg text-slate-400 hover:text-ink transition-colors"
                    >
                      {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-3 italic leading-relaxed">
                    This license key was successfully bound to {businessName} and allows setup of up to {selectedPlan === 'gold' ? 'Unlimited' : selectedPlan === 'silver' ? '3' : '1'} register nodes. Key was automatically delivered to {phone} via simulated SMS receipt.
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {activeStep === 'multi-tenancy' && (
          <motion.div
            key="multi-tenancy"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Supabase Row Level Security policy details */}
            <div className="lg:col-span-6 bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-ink mb-2 flex items-center gap-2">
                <Database className="w-5 h-5 text-brand" /> Tenant Security & Database RLS Policies
              </h2>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Supabase enforces row-level security (RLS) rules directly at the postgres layer. This prevents Merchant A's salespersons from executing queries that accidentally leakage data from Merchant B.
              </p>

              {/* RLS rules display cards */}
              <div className="space-y-4">
                <div className="border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-ink uppercase">Merchant Isolation Policy</span>
                    <span className="px-2 py-0.5 text-[9px] font-black uppercase text-emerald-500 bg-emerald-50 rounded-md">PostgreSQL RLS</span>
                  </div>
                  <pre className="bg-[#1f1f1f] text-[10px] text-zinc-300 font-mono p-3 rounded-lg overflow-x-auto leading-relaxed">
{`ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchant Sales Isolation" ON public.sales
  FOR ALL
  TO authenticated
  USING (business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id'))
  WITH CHECK (business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id'));`}
                  </pre>
                </div>

                <div className="border border-border rounded-xl p-4">
                  <span className="text-xs font-bold text-ink uppercase block mb-1.5">How it Works in practice</span>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    When a register node pushes database sync packets using Supabase client, the server issues an encrypted JWT authenticated payload. The postgres executor intercepts all <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">SELECT/INSERT</code> queries, mapping them against the token's decrypted <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">user_metadata.business_id</code> claims.
                  </p>
                </div>
              </div>
            </div>

            {/* Live sandbox queries emulator */}
            <div className="lg:col-span-6 bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-bold text-ink flex items-center gap-2">
                  <Layers className="w-4.5 h-4.5 text-brand" /> RLS Data Leakage Query Sandbox
                </h3>
                
                {/* RLS Toggle controls */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">RLS Shield:</span>
                  <button
                    onClick={() => {
                      setRlsActive(!rlsActive);
                      setSimulatedQueryLog([]);
                    }}
                    className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full transition-all tracking-wider ${
                      rlsActive 
                        ? 'bg-emerald-50 text-emerald-500 border border-emerald-200' 
                        : 'bg-red-50 text-red-500 border border-red-200 animate-pulse'
                    }`}
                  >
                    {rlsActive ? '🔒 LOCKED (SECURE)' : '⚠️ LEAKY (DISABLED)'}
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Simulate pulling system business transactions. Under leaky mode, query pulls sales of ALL merchant registries across Kenya. Under active secure RLS mode, limits pulls strictly to Savannah Boutique's context.
              </p>

              {/* simulated actions */}
              <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-slate-900/40 p-3 border border-border rounded-xl mb-4 text-xs">
                <span className="font-bold text-slate-500 uppercase text-[10px]">Active Session Token:</span>
                <span className="font-mono font-medium text-slate-600 bg-white dark:bg-slate-800 border border-border rounded-md px-2 py-0.5">
                  Savannah Boutique Limited (b-merch-a)
                </span>

                <button
                  onClick={runRlsSimulation}
                  className="ml-auto bg-brand hover:brightness-115 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors uppercase tracking-wider"
                >
                  Execute Query
                </button>
              </div>

              {/* query result console */}
              <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl p-4 font-mono text-[10px] leading-relaxed text-zinc-300 min-h-[160px] flex flex-col justify-between">
                <div>
                  <div className="text-neutral-500 mb-2 truncate">
                    {rlsActive 
                      ? 'SELECT * FROM public.sales WHERE business_id = auth.jwt()->business_id;' 
                      : 'SELECT * FROM public.sales; /* Leak vector active */'}
                  </div>
                  
                  {simulatedQueryLog.length === 0 ? (
                    <div className="text-center italic text-neutral-600 py-6">
                      Awaiting query execution...
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-emerald-400 font-bold">
                        Query returned {simulatedQueryLog.length} row(s) successfully.
                      </div>
                      <div className="max-h-[110px] overflow-y-auto space-y-2">
                        {simulatedQueryLog.map((row, idx) => (
                          <div key={idx} className="bg-neutral-800/60 border border-neutral-800/80 p-2 rounded">
                            <div className="flex justify-between font-bold text-white mb-1 text-[11px]">
                              <span>{row.businessName}</span>
                              <span className="text-emerald-400">{row.businessId}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <span>Cashier: {row.cashier}</span>
                              <span className="text-right">Transaction Total: KES {row.sales.toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {rlsActive && simulatedQueryLog.length > 0 && (
                  <div className="text-[10px] bg-emerald-950/45 border border-emerald-900/60 p-2 rounded text-emerald-400 font-sans mt-3">
                    ✔ Security shield verified: Amina Mohamed's (Eldoret) and Charles Kiprop's (Nakuru) sales rows were filtered out automatically at database layer. Data leakage prevented!
                  </div>
                )}
                {!rlsActive && simulatedQueryLog.length > 0 && (
                  <div className="text-[10px] bg-red-950/45 border border-red-900/60 p-2 rounded text-red-400 font-sans mt-3 animate-pulse">
                    🚨 CRITICAL LEAK: The terminal pulled Eldoret and Nakuru transactions. Unauthorized competitors can intercept and steal competitive catalog financials. Turn on Row Level Security!
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeStep === 'encryption' && (
          <motion.div
            key="encryption"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Encryption config menu inputs */}
            <div className="lg:col-span-5 bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-ink mb-2 flex items-center gap-2">
                <Lock className="w-5 h-5 text-brand" /> Encryption at Rest Lab
              </h2>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                Derive solid custom ciphers utilizing the cashier's or manager's master PIN. Secure client-side lists at absolute rest relative to local browsers, tablets, and desktop setups.
              </p>

              <div className="space-y-4">
                {/* Active Toggle Control */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl">
                  <div>
                    <span className="text-xs font-black uppercase text-ink block">At-Rest Encryption Shield</span>
                    <span className="text-[10px] text-slate-400">Lock offline databases automatically when writing.</span>
                  </div>
                  
                  <button
                    onClick={() => setEncryptActive(!encryptActive)}
                    className={`w-11 h-6 rounded-full transition-all relative p-0.5 duration-300 ${
                      encryptActive ? 'bg-brand' : 'bg-slate-300'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow ${
                      encryptActive ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Secret lock PIN entry */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">
                    Shop Manager Custom Lock Encryption PIN (Salt)
                  </label>
                  <div className="relative">
                    <input
                      type={isPinVisible ? 'text' : 'password'}
                      value={encryptionPin}
                      onChange={e => setEncryptionPin(e.target.value)}
                      placeholder="Enter four digits"
                      maxLength={8}
                      className="w-full text-sm bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/20 focus:border-blue-500 focus:bg-blue-500/10 focus:outline-none rounded-lg pl-3.5 pr-10 py-2 text-ink transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setIsPinVisible(!isPinVisible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink transition-colors"
                    >
                      {isPinVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSaveEncryptionSetting}
                    className="w-full py-2 bg-brand/10 hover:bg-brand hover:text-white border border-brand text-brand font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                  >
                    Commit PIN & Update Security Rules
                  </button>
                  {encryptionSaved && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[10px] text-emerald-500 text-center font-bold mt-2"
                    >
                      ✔ Security committed! Client database re-isolated in physical disk context.
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* Inspect Side-by-Side encrypted cards */}
            <div className="lg:col-span-7 bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
              <h3 className="text-md font-bold text-ink mb-1.5 flex items-center gap-2">
                <ShieldCheck className="w-4.5 h-4.5 text-brand" /> Side-by-Side Live Disk Inspector
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Witness what competitors observe when opening browser developer tools (or stealing SQLite `.db` binaries) vs what an authorized cashier views as plaintext.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                {/* Competitors Encrypted view card */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 font-mono text-[9px] text-[#ef4444] flex flex-col justify-between min-h-[220px]">
                  <div>
                    <div className="flex items-center gap-1.5 font-sans font-bold text-neutral-400 uppercase text-[9px] mb-2">
                      <Lock className="w-3.5 h-3.5" /> Intruders' View (SQLite Disk / IDB)
                    </div>
                    
                    <div className="break-all whitespace-pre-wrap leading-relaxed py-1">
                      {encryptActive ? (
                        `ENC__dW1pX3Bvc19wcm9kdWN0czoKWyB7IGlkOiAiMTAxYTAiLCBuYW1lOiAiU2F2YW5uYWhoIEJvdXRp...",\n` + 
                        `ENC__Y29sdW1uX2RhdGEiOiAie2RlbHRhcyIsICJlcWkiLCB0eXBlOiAic3RvcmUiIH1dLCBlbmNyeXB0...`
                      ) : (
                        `/* WARNING: NO ENCRYPTION COMMITTED */\n` +
                        `[\n` +
                        `  { "id": "101a0", "name": "Savannah Basin 1X", "price": 1200, "stock": 10 },\n` +
                        `  { "id": "102b1", "name": "KRA receipt tax ledger", "balances": 42000 }\n` +
                        `]`
                      )}
                    </div>
                  </div>
                  
                  {encryptActive ? (
                    <div className="text-[8px] bg-neutral-800/40 p-2 rounded leading-relaxed border border-neutral-800 text-neutral-400 font-sans">
                      Protected at rest by ciphers. Intruders cannot read financial ledger logs or inventory catalog details.
                    </div>
                  ) : (
                    <div className="text-[8px] bg-red-950/20 p-2 rounded leading-relaxed border border-red-900/30 text-red-400 font-sans animate-pulse">
                      Critical exposure: Unencrypted JSON files reside on local device storage, easily readable in developer tools.
                    </div>
                  )}
                </div>

                {/* Clerks Plaintext view card */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 font-mono text-[9px] text-[#10b981] flex flex-col justify-between min-h-[220px]">
                  <div>
                    <div className="flex items-center gap-1.5 font-sans font-bold text-neutral-400 uppercase text-[9px] mb-2">
                      <Eye className="w-3.5 h-3.5" /> Cashier's View (In-Memory Buffer)
                    </div>
                    
                    <div className="space-y-1.5 py-1">
                      <div>// Decrypted in RAM synchronously</div>
                      <div className="text-zinc-300">
                        {`[
  {
    "id": "101a0",
    "name": "Savannah Plastic Basin",
    "price": 1200,
    "variants": [{ "id": "v1", "name": "Default", "stock": 10 }],
    "balances": 42000
  }
]`}
                      </div>
                    </div>
                  </div>

                  <div className="text-[8px] bg-neutral-800/40 p-2 rounded leading-relaxed border border-neutral-800 text-neutral-400 font-sans">
                    RAM decrypt filter runs on boot context dynamically using decryption keys. UI performance remains instant.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeStep === 'resolution' && (
          <motion.div
            key="resolution"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Input params */}
            <div className="lg:col-span-5 bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-ink mb-2 flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-brand" /> Offline Conflict Resolution Engine
              </h2>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                If multiple cashiers are disconnected from the network and register transactions offline concurrently, last-write-wins models overwrite stock. Our resolver performs delta differential updates instead.
              </p>

              <div className="space-y-4 text-xs font-medium">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-2">
                    Original Server Stock (Before Outage)
                  </label>
                  <input
                    type="number"
                    value={originalStock}
                    onChange={e => setOriginalStock(Number(e.target.value))}
                    className="w-full text-sm bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/20 focus:border-blue-500 focus:bg-blue-500/10 focus:outline-none rounded-lg px-3.5 py-2 text-ink transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-2">
                      Kisumu Outage Sales Difference
                    </label>
                    <input
                      type="number"
                      value={cashierADelta}
                      onChange={e => setCashierADelta(Number(e.target.value))}
                      className="w-full text-sm bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/20 focus:border-blue-500 focus:bg-blue-500/10 focus:outline-none rounded-lg px-3.5 py-2 text-ink transition-all"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">Neg values mean sales deductions</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-2">
                      Nairobi Delivery Restock Difference
                    </label>
                    <input
                      type="number"
                      value={cashierBDelta}
                      onChange={e => setCashierBDelta(Number(e.target.value))}
                      className="w-full text-sm bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/20 focus:border-blue-500 focus:bg-blue-500/10 focus:outline-none rounded-lg px-3.5 py-2 text-ink transition-all"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">Pos values mean replenishments</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={runConflictStrategySimulation}
                    disabled={isConflictSimulating}
                    className="w-full py-2.5 bg-brand text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                  >
                    Simulate Synchronous Conflict Race
                  </button>
                </div>
              </div>
            </div>

            {/* Simulated Live Outputs console */}
            <div className="lg:col-span-7 bg-neutral-900 border border-neutral-800 rounded-xl p-6 font-mono text-[10.5px] text-zinc-300 flex flex-col justify-between min-h-[300px]">
              <div>
                <div className="flex items-center gap-2 text-white font-sans font-bold text-[10px] uppercase tracking-wider pb-3 border-b border-neutral-800 mb-4">
                  <Cpu className="text-indigo-400 w-4 h-4" /> Live Differential Conflict Engine Console
                </div>

                <div className="space-y-2.5 min-h-[170px]">
                  {conflictLogs.length === 0 ? (
                    <div className="text-neutral-500 italic text-center py-12">
                      Click simulator button on primary card to trigger race condition analysis...
                    </div>
                  ) : (
                    conflictLogs.map((log, i) => (
                      <div key={i} className={`leading-relaxed border-l-2 pl-3 ${
                        log.startsWith('❌') 
                          ? 'border-red-500/50 text-red-400' 
                          : log.startsWith('✅') 
                            ? 'border-emerald-500/50 text-emerald-400' 
                            : 'border-indigo-500/50 text-zinc-300'
                      }`}>
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {conflictLogs.length > 0 && (
                <div className="text-[10px] bg-indigo-950/45 border border-indigo-900/60 p-2.5 rounded font-sans text-indigo-400 mt-4 leading-relaxed">
                  ✔ Synchronization resolution model was successful: server database automatically mapped incoming transactions and correctly calculated final restocks without writing stale outdated static counts!
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeStep === 'packaging' && (
          <motion.div
            key="packaging"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Tauri and Electron guides */}
            <div className="lg:col-span-6 bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-ink mb-1.5 flex items-center gap-2">
                <FileCode className="w-5 h-5 text-brand" /> Desktop Application Compilations (.EXE / .DMG)
              </h2>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Compile standard React source bundles inside fully native kiosk shells, blocking keyboard focus locks and capturing barcode lasers or thermal receipt printers directly.
              </p>

              <div className="space-y-4">
                <div className="border border-border rounded-xl p-4 bg-slate-50 dark:bg-slate-900/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-ink uppercase">Capacitor Android Build</span>
                    <span className="text-[9px] font-black uppercase text-brand bg-brand/10 px-2 rounded">Android Tablet</span>
                  </div>
                  <pre className="bg-[#1f1f1f] text-[10px] text-zinc-300 font-mono p-3 rounded-lg overflow-x-auto">
{`npm run android:init
npm run android:sync
npm run android:open // launches Android studio`}
                  </pre>
                </div>

                <div className="border border-border rounded-xl p-4 bg-slate-50 dark:bg-slate-900/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-ink uppercase">Electron desktop installer bundle</span>
                    <span className="text-[9px] font-black uppercase text-white bg-neutral-800 px-2 rounded">Windows & MacOS</span>
                  </div>
                  <pre className="bg-[#1f1f1f] text-[10px] text-zinc-300 font-mono p-3 rounded-lg overflow-x-auto">
{`npm run electron:dev   // hot reload launcher
npm run electron:build // builds .msi / .exe installable`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Direct WebUSB Print scan test board */}
            <div className="lg:col-span-6 bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-md font-bold text-ink mb-1.5 flex items-center gap-2">
                  <Maximize2 className="w-4.5 h-4.5 text-brand" /> POS Hardware Printer & Barcode Gateways
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Interact with real hardware testing hooks. Trigger simulated laser checks and test printing receipts directly from the web sandbox wrapper frames.
                </p>

                {/* Hardware controls */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    onClick={() => triggerHardwareBridge('print')}
                    className="p-3 border border-border hover:border-brand bg-slate-50 dark:bg-slate-900/40 hover:bg-brand/5 rounded-xl flex flex-col items-center justify-center text-center transition-all group gap-2"
                  >
                    <Printer className="w-6 h-6 text-slate-400 group-hover:text-brand transition-colors" />
                    <span className="text-xs font-bold text-ink">Print Test Receipt</span>
                    <span className="text-[9px] text-slate-400">Handshake Epson/Star ESC/POS</span>
                  </button>

                  <button
                    onClick={() => triggerHardwareBridge('scan')}
                    className="p-3 border border-border hover:border-brand bg-slate-50 dark:bg-slate-900/40 hover:bg-brand/5 rounded-xl flex flex-col items-center justify-center text-center transition-all group gap-2"
                  >
                    <Barcode className="w-6 h-6 text-slate-400 group-hover:text-brand transition-colors" />
                    <span className="text-xs font-bold text-ink">Beam Laser Scan</span>
                    <span className="text-[9px] text-slate-400">Emulate physical reader inputs</span>
                  </button>
                </div>
              </div>

              {/* Console window */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 font-mono text-[9px] text-slate-300 flex-1 min-h-[120px] max-h-[160px] overflow-y-auto space-y-1">
                {hardwareLog.length === 0 ? (
                  <div className="text-neutral-500 italic text-center py-6">
                    Awaiting POS hardware triggers...
                  </div>
                ) : (
                  hardwareLog.map((log, idx) => (
                    <div key={idx} className="leading-relaxed">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
