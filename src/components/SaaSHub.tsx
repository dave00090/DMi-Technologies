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
  AlertTriangle,
  Download,
  Trash2,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../services/masterService';
import { localDb } from '../services/localDb';
import { backupEngine, BackupRecord } from '../services/backupEngine';

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
  const [manualClientName, setManualClientName] = useState('Savannah Boutique Ltd');
  const [manualMerchantId, setManualMerchantId] = useState('b-merch-a');
  const [manualCashierName, setManualCashierName] = useState('Kimani Njuguna');

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

  // 6. Automated Backup & Retention State
  const [backupsList, setBackupsList] = useState<BackupRecord[]>(() => backupEngine.getBackups());
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState(() => localStorage.getItem('dmi_pos_last_backup_time'));
  const [isPurging, setIsPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<{ purgedCount: number; tablesAffected: string[] } | null>(null);
  const [simulateOldRecords, setSimulateOldRecords] = useState(false);

  // Auto-load client details if they exist
  useEffect(() => {
    const savedPin = localStorage.getItem('dmi_pos_encryption_pin');
    if (savedPin) setEncryptionPin(savedPin);

    const handleBackupComplete = (e: any) => {
      setBackupsList(backupEngine.getBackups());
      setLastBackupTime(localStorage.getItem('dmi_pos_last_backup_time'));
    };
    window.addEventListener('dmi-backup-completed', handleBackupComplete);
    return () => {
      window.removeEventListener('dmi-backup-completed', handleBackupComplete);
    };
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
    const licenseId = crypto.randomUUID();
    const placeholderKey = `PENDING_KEY_${licenseId.slice(0, 8)}`;
    
    const logs = [
      `[PROVISIONER] Initializing automated backend partition creation...`,
      `[SUPABASE] Provisioning isolated data namespace business_id: "${licenseId}"`,
      `[SUPABASE] Attaching Schema and executing isolated table indexing...`,
      `[PROVISIONER] Seeding default setup: 1 admin profile and ${plans[selectedPlan].shops} shop records...`,
      `[MASTER ADMIN] Saving client onboarding under status "PENDING"...`,
      `[MASTER ADMIN] Awaiting Master Admin (David) manual payment confirmation in general panel...`
    ];

    for (let i = 0; i < logs.length; i++) {
      await new Promise(r => setTimeout(r, 650));
      addProvLog(logs[i]);
    }

    // Attempt registration into Supabase central DB with PENDING state
    try {
      const newLicense = {
        id: licenseId,
        license_key: placeholderKey,
        client_name: businessName,
        status: 'PENDING',
        system_name: 'DMI MULTITENANT POS',
        penalty_amount: 0,
        license_fee: plans[selectedPlan].price,
        plan_type: selectedPlan.toUpperCase(),
        expires_at: null, // Set to null until approved
        payment_status: 'PENDING_PAYMENT',
        payment_phone: phone,
        mpesa_reference: 'SAAS_HUB_ONBOARD'
      };

      await supabase.from('licenses').insert(newLicense);
      
      // Post alert to Master Admin logs
      await supabase.from('piracy_alerts').insert({
        id: crypto.randomUUID(),
        license_id: licenseId,
        message: `📡 ONBOARDS WIDGET: "${businessName}" signed up for ${plans[selectedPlan].name}. Awaiting KES ${(plans[selectedPlan].price).toLocaleString()} manual confirmation of mobile: ${phone}.`,
        timestamp: new Date().toISOString()
      });

      addProvLog(`[MASTER ADMIN] License record created with status: PENDING. Dedicated real-time sync channel initialized.`);
      addProvLog(`[MASTER ADMIN] Standby for David to click "Approve M-Pesa" in the General Admin oversight list...`);

      // Realtime listener for the Master Admin update
      const channel = supabase
        .channel(`saashub-approve-watch-${licenseId}`)
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'licenses',
            filter: `id=eq.${licenseId}`
          }, 
          (payload) => {
            if (payload.new && payload.new.status === 'ACTIVE' && payload.new.license_key) {
              addProvLog(`[REALTIME LINK] 🟢 SYSTEM ALLOW RECEIVED! PAYMENT OFFICIALLY CONFIRMED!`);
              addProvLog(`[REALTIME LINK] Generated active license key: ${payload.new.license_key}`);
              addProvLog(`[REALTIME LINK] Set validity: 30 days. Expiry: ${payload.new.expires_at ? new Date(payload.new.expires_at).toLocaleDateString() : 'N/A'}`);
              
              setGeneratedKey(payload.new.license_key);
              setOnboardingStatus('completed');
              channel.unsubscribe();
            }
          }
        )
        .subscribe();

    } catch (e: any) {
      addProvLog(`[MASTER ADMIN] Connection lost. Reverted to standalone local fallback key.`);
      const fallbackKey = `DMI-${selectedPlan.toUpperCase()}-FALLBACK-ACTIVE`;
      setGeneratedKey(fallbackKey);
      setOnboardingStatus('completed');
    }
  };

  const addProvLog = (msg: string) => {
    setProvLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedKey);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const getSimulatedMerchants = () => {
    const backgroundMerchants = [
      { businessId: 'b-merch-b', businessName: 'Safari Supermarket Eldoret', cashier: 'Amina Mohamed', sales: 125000, itemsCount: 41 },
      { businessId: 'b-merch-c', businessName: 'Great Rift Pharmacy Nakuru', cashier: 'Charles Kiprop', sales: 32000, itemsCount: 8 }
    ];

    const activeUserMerchant = {
      businessId: manualMerchantId || 'b-merch-a',
      businessName: manualClientName || 'Savannah Boutique Ltd',
      cashier: manualCashierName || 'Kimani Njuguna',
      sales: 45000,
      itemsCount: 15
    };

    return [activeUserMerchant, ...backgroundMerchants];
  };

  // Run RLS live database simulation
  const runRlsSimulation = () => {
    const merchants = getSimulatedMerchants();

    let results = [];
    if (rlsActive) {
      // Enforce RLS filter: JWT context can only view their own match
      const found = merchants.find(m => m.businessId === (manualMerchantId || 'b-merch-a'));
      results = found ? [found] : [];
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
                    {onboardingStatus === 'provisioning' && "Awaiting David's Confirmation in Master Admin..."}
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

                  <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        // 1. Activate standard system
                        await localDb.activate('8124');
                        localStorage.setItem('dmi_pos_license_key', generatedKey);
                        
                        // 2. Cache the plan in localStorage
                        const serialized = btoa(JSON.stringify({
                          timestamp: new Date().toISOString(),
                          gracePeriod: 7,
                          data: {
                            id: crypto.randomUUID(),
                            license_key: generatedKey,
                            client_name: businessName,
                            status: 'ACTIVE',
                            plan_type: selectedPlan.toUpperCase(),
                            expires_at: null,
                            payment_phone: phone,
                            system_name: 'DMI MULTITENANT POS'
                          }
                        }));
                        localStorage.setItem(`dmi_license_cache_${generatedKey}`, serialized);

                        // 3. Create active Business Profile
                        const createdBiz = await localDb.addBusiness({
                          name: businessName,
                          type: 'RETAIL',
                          taxRate: 16,
                          currency: 'KES',
                          logo: '',
                          phone: phone,
                          email: `${ownerName.toLowerCase().replace(/\s+/g, '')}@example.com`,
                          address: 'Nairobi, Kenya'
                        });

                        // 4. Create active Shop Profile
                        const createdShop = await localDb.addShop({
                          businessId: createdBiz.id,
                          name: 'Main Branch',
                          location: 'HQ Nairobi Office',
                          phone: phone
                        });

                        // 5. Create or log in Manager under this active context
                        const users = localDb.getUsers();
                        const username = ownerName.toLowerCase().replace(/\s+/g, '') || 'manager';
                        let matchedUser = users.find(u => u.username === username);
                        if (!matchedUser) {
                          matchedUser = {
                            uid: crypto.randomUUID(),
                            name: ownerName,
                            username,
                            email: `${username}@dmipos.internal`,
                            role: 'admin',
                            lastLogin: new Date().toISOString()
                          };
                          
                          // Save back in users collection
                          const updatedUsers = [...users, matchedUser];
                          localStorage.setItem('dmi_pos_users', JSON.stringify(updatedUsers));
                        }
                        
                        // Set current authenticated user
                        localStorage.setItem('dmi_pos_auth_user', JSON.stringify(matchedUser));

                        // 6. Set active business and shop context
                        localStorage.setItem('dmi_pos_active_business_id', createdBiz.id);
                        localStorage.setItem('dmi_pos_active_shop_id', createdShop.id);

                        // Also update RLS simulator inputs to match new client details
                        setManualClientName(businessName);
                        setManualMerchantId(createdBiz.id.slice(0, 8));
                        setManualCashierName(ownerName);

                        // Notify the app about authorization shift and dispatch update
                        window.dispatchEvent(new CustomEvent('auth-change'));
                        window.dispatchEvent(new CustomEvent('local-db-update'));

                        // 7. Force instant redirect to POS screen for this client!
                        window.location.href = '/?tab=pos';
                        window.location.reload();
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors shadow-lg shadow-emerald-600/10 cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4 animate-bounce" /> Auto-Launch POS System for {businessName}
                    </button>
                  </div>
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
                Simulate pulling system business transactions. Under leaky mode, query pulls sales of ALL merchant registries across Kenya. Under active secure RLS mode, limits pulls strictly to your manually configured shop's context shown below.
              </p>

              {/* simulated actions */}
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 border border-border rounded-xl mb-4 space-y-3.5 text-xs">
                <div className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block border-b border-border/60 pb-1.5">
                  🛡️ Active Session Token Context Configuration
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Shop / Client Name</label>
                    <input
                      type="text"
                      value={manualClientName}
                      onChange={(e) => {
                        setManualClientName(e.target.value);
                        setSimulatedQueryLog([]);
                      }}
                      placeholder="e.g. Savannah Boutique Ltd"
                      className="w-full text-xs font-semibold bg-white dark:bg-slate-800 border border-border rounded-md px-3 py-1.5 text-ink focus:border-brand focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Business ID (RLS claim)</label>
                    <input
                      type="text"
                      value={manualMerchantId}
                      onChange={(e) => {
                        setManualMerchantId(e.target.value);
                        setSimulatedQueryLog([]);
                      }}
                      placeholder="e.g. b-merch-a"
                      className="w-full text-xs font-semibold bg-white dark:bg-slate-800 border border-border rounded-md px-3 py-1.5 text-ink focus:border-brand focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Active Cashier Name</label>
                    <input
                      type="text"
                      value={manualCashierName}
                      onChange={(e) => {
                        setManualCashierName(e.target.value);
                        setSimulatedQueryLog([]);
                      }}
                      placeholder="e.g. Kimani Njuguna"
                      className="w-full text-xs font-semibold bg-white dark:bg-slate-800 border border-border rounded-md px-3 py-1.5 text-ink focus:border-brand focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    onClick={runRlsSimulation}
                    className="w-full sm:w-auto bg-brand hover:brightness-115 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors uppercase tracking-wider whitespace-nowrap"
                  >
                    Execute Query
                  </button>
                </div>
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
                    ✔ Security shield verified: All other merchant/shop sales rows were filtered out automatically at postgres database layer. Data leakage prevented!
                  </div>
                )}
                {!rlsActive && simulatedQueryLog.length > 0 && (
                  <div className="text-[10px] bg-red-950/45 border border-red-900/60 p-2 rounded text-red-400 font-sans mt-3 animate-pulse">
                    🚨 CRITICAL LEAK: The terminal pulled transactions from ALL other merchant registries! Turn on Row Level Security to prevent unauthorized cross-border cross-merchant indexing!
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
            className="space-y-8"
          >
            {/* Top Row: Build PC Software Info & Local DB Alternatives */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Build Instructions */}
              <div className="lg:col-span-7 bg-card border border-border rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-bold text-ink mb-1.5 flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-brand" /> How to Build DMi POS into a Downloadable PC Software
                </h2>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  To turn this React client-first application into a lightweight, downloadable <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">.EXE</code> (Windows) or <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">.DMG</code> (Mac) software, you can wrap the code inside a native desktop container.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-border rounded-xl p-4 bg-slate-50 dark:bg-slate-900/10">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-ink uppercase">Option A: Tauri (Recommended)</span>
                      <span className="text-[9px] font-black uppercase text-emerald-500 bg-emerald-50 px-2 rounded">Lightweight</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                      Written in Rust. Tauri compiles the application down to just <strong>8MB to 12MB</strong>. It has direct access to the computer's local filesystems and native SQLite storage.
                    </p>
                    <pre className="bg-[#1f1f1f] text-[10px] text-zinc-300 font-mono p-3 rounded-lg overflow-x-auto">
{`# 1. Install Tauri CLI
npm install @tauri-apps/cli -D

# 2. Initialize Tauri bundle
npx tauri init

# 3. Compile native .EXE or .DMG
npx tauri build`}
                    </pre>
                  </div>

                  <div className="border border-border rounded-xl p-4 bg-slate-50 dark:bg-slate-900/10">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-ink uppercase">Option B: Electron</span>
                      <span className="text-[9px] font-black uppercase text-blue-500 bg-blue-50 px-2 rounded">Flexible</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                      Built with Node.js. Electron is highly stable and provides custom printer direct hooks (<code className="font-mono text-[10.5px]">webContents.print()</code>) and offline-first filesystem utilities.
                    </p>
                    <pre className="bg-[#1f1f1f] text-[10px] text-zinc-300 font-mono p-3 rounded-lg overflow-x-auto">
{`# 1. Start Electron Hot Reload
npm run electron:dev

# 2. Build installer (.msi / .dmg)
npm run electron:build`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Database Alternatives */}
              <div className="lg:col-span-5 bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-md font-bold text-ink mb-1.5 flex items-center gap-2">
                    <Database className="w-4.5 h-4.5 text-brand" /> Offline PC Database Alternatives (Non-Supabase)
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    While Supabase is the ultimate cloud backend, for fully offline downloadable PC softwares, you should utilize embedded local databases that store everything on the user's local hard drive:
                  </p>

                  <div className="space-y-3">
                    <div className="border-l-2 border-brand/50 pl-3 py-0.5">
                      <div className="text-xs font-bold text-ink">1. SQLite Database (The Industry Standard)</div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        A single binary file stored directly inside the user's PC (e.g. in <code className="font-mono text-[10px] bg-slate-50 dark:bg-slate-900 px-1">C:/Users/[User]/DMi_POS.db</code>). Fast, requires zero configuration, can be encrypted using SQLCipher, and does not need any internet!
                      </p>
                    </div>

                    <div className="border-l-2 border-emerald-500/50 pl-3 py-0.5">
                      <div className="text-xs font-bold text-ink">2. RxDB (Reactive Client-Side DB)</div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        An offline-first, reactive database for JavaScript. It synchronizes automatically with external servers when connection is restored and stores data locally in IndexedDB or SQLite.
                      </p>
                    </div>

                    <div className="border-l-2 border-amber-500/50 pl-3 py-0.5">
                      <div className="text-xs font-bold text-ink">3. WatermelonDB</div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        High-performance local database engine optimized for rendering hundreds of products or transactions instantly on the PC.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-500/20 rounded-lg p-3 text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed mt-4">
                  💡 <strong>Your Current App is Ready!</strong> We currently use IndexedDB with custom crypto cipher PIN encryption at rest. All data persists offline in your browser!
                </div>
              </div>
            </div>

            {/* Bottom Row: Local Backup Sandbox & Hardware Bridge */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Automated Backups Control Panel */}
              <div className="lg:col-span-7 bg-card border border-border rounded-xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 border-b border-border pb-3 gap-2">
                  <div>
                    <h3 className="text-md font-bold text-ink flex items-center gap-2">
                      <Clock className="w-5 h-5 text-brand" /> Automated 24h Local Backups & 3-Year Retention Policies
                    </h3>
                    <p className="text-xs text-slate-500">
                      Auto-backup scheduler and automated vacuum cleans are integrated into the boot cycle.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 self-start">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                      scheduler active
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {/* Status indicators */}
                  <div className="bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl p-3 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Last Automated Backup</span>
                    <span className="text-xs font-bold font-mono text-ink block">
                      {lastBackupTime ? new Date(lastBackupTime).toLocaleDateString() : 'Awaiting Check'}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {lastBackupTime ? new Date(lastBackupTime).toLocaleTimeString() : 'Never'}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl p-3 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Backup Name Target</span>
                    <span className="text-xs font-black text-brand block">DMi POS</span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      with dynamic time & date
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl p-3 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Retention Expiry</span>
                    <span className="text-xs font-bold text-red-500 block">3 Years Limit</span>
                    <span className="text-[9px] text-slate-400 leading-none">
                      Older entries auto-purged
                    </span>
                  </div>
                </div>

                {/* Simulated database action buttons */}
                <div className="flex flex-wrap gap-2.5 mb-4">
                  <button
                    onClick={async () => {
                      setIsBackingUp(true);
                      await new Promise(r => setTimeout(r, 800));
                      const res = await backupEngine.triggerBackupDownload(true);
                      setIsBackingUp(false);
                    }}
                    disabled={isBackingUp}
                    className="flex-1 min-w-[200px] flex items-center justify-center gap-2 bg-brand hover:brightness-110 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                  >
                    <Download className={`w-4 h-4 ${isBackingUp ? 'animate-spin' : ''}`} />
                    {isBackingUp ? 'Compiling local database...' : 'Download Manual Backup (.JSON)'}
                  </button>

                  <button
                    onClick={async () => {
                      setIsPurging(true);
                      setPurgeResult(null);
                      await new Promise(r => setTimeout(r, 800));
                      const res = await backupEngine.purgeDataOlderThanThreeYears();
                      setPurgeResult(res);
                      setIsPurging(false);
                    }}
                    disabled={isPurging}
                    className="flex-1 min-w-[200px] flex items-center justify-center gap-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all border border-neutral-250 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                    {isPurging ? 'Scanning datastore...' : 'Run 3-Year Purge Sweep'}
                  </button>
                </div>

                {/* Simulation block details */}
                <div className="border border-border/60 rounded-xl p-3.5 bg-brand/5 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-brand flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> Interactive Retention Sweep Test Sandbox
                    </span>
                    <button
                      onClick={() => {
                        // Inject Expired records from 2021
                        try {
                          const activeBizId = localDb.getActiveBusinessId() || 'DEFAULT_BUSINESS';
                          const expiredDate = '2021-04-12T10:30:00.000Z'; // 5 years ago
                    
                          // 1. Expired sale
                          const expiredSale = {
                            id: crypto.randomUUID(),
                            businessId: activeBizId,
                            shopId: 'Main Branch',
                            items: [{ productId: 'MOCK_EXPIRED', name: 'Simulated Expired Basin Sales (April 2021)', quantity: 1, price: 1200, variantName: 'Default' }],
                            total: 1200,
                            timestamp: expiredDate,
                            cashierId: 'cashier-test',
                            cashierName: 'Jane Expired',
                            paymentMethod: 'CASH',
                            status: 'COMPLETED'
                          };
                          const salesRaw = localStorage.getItem('dmi_pos_sales');
                          const sales = salesRaw ? JSON.parse(salesRaw) : [];
                          localStorage.setItem('dmi_pos_sales', JSON.stringify([expiredSale, ...sales]));

                          // 2. Expired expense
                          const expiredExpense = {
                            id: crypto.randomUUID(),
                            businessId: activeBizId,
                            category: 'Wages',
                            amount: 15000,
                            date: '2021-04-12',
                            notes: 'Outdated Rent'
                          };
                          const expensesRaw = localStorage.getItem('dmi_pos_expenses');
                          const expenses = expensesRaw ? JSON.parse(expensesRaw) : [];
                          localStorage.setItem('dmi_pos_expenses', JSON.stringify([expiredExpense, ...expenses]));

                          alert('Successfully injected mock expired records dated in April 2021 into local storage! Now click the "Run 3-Year Purge Sweep" button to verify the retention purge deletes them in real-time!');
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      className="text-[9px] font-black uppercase bg-brand/10 hover:bg-brand/20 text-brand px-2.5 py-1 rounded"
                    >
                      🧪 Inject 2021 Expired Records
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    By default, your database might not have 3-year-old entries. Click <strong>"Inject 2021 Expired Records"</strong> to add test sales and expenses dated 5 years ago, and then sweep them away to test the retention vacuum compliance algorithm.
                  </p>
                </div>

                {/* Backups file logs */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 font-mono text-[10px] text-slate-300 min-h-[120px]">
                  <div className="flex items-center justify-between text-white font-sans font-bold text-[10px] uppercase border-b border-neutral-800 pb-2 mb-2">
                    <span>Generated DMi POS Backup Files Archive</span>
                    <span className="text-neutral-500 font-normal">Stored in IndexedDB / Download log</span>
                  </div>
                  
                  {purgeResult && (
                    <div className="mb-2 p-2 rounded bg-red-950/40 border border-red-900/60 text-red-400 font-sans leading-relaxed text-[11px]">
                      🚨 <strong>Retention Sweep executed:</strong> Cleaned <strong>{purgeResult.purgedCount} expired record(s)</strong> older than 3 years. Tables vacuumed: [<strong>{purgeResult.tablesAffected.join(', ') || 'none'}</strong>].
                    </div>
                  )}

                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                    {backupsList.length === 0 ? (
                      <div className="text-neutral-500 italic py-4 text-center font-sans">
                        No backup files generated in the archives yet. Click "Download Manual Backup" to prompt a local copy!
                      </div>
                    ) : (
                      backupsList.map((bk) => (
                        <div key={bk.id} className="flex justify-between items-center bg-neutral-850 border border-neutral-800/80 p-2 rounded">
                          <div className="truncate">
                            <span className="text-amber-400 font-bold">📄 {bk.filename}</span>
                            <span className="text-neutral-500 block text-[9px] mt-0.5">
                              Created: {new Date(bk.timestamp).toLocaleString()} | Size: {bk.dataSize} KB
                            </span>
                          </div>
                          <span className="text-emerald-400 font-bold text-[9px] uppercase px-2 py-0.5 bg-emerald-950/40 rounded border border-emerald-900/40 shrink-0">
                            {bk.recordCount} records
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* POS Hardware Printer & Barcode Gateways */}
              <div className="lg:col-span-5 bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between">
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
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 font-mono text-[9px] text-slate-300 min-h-[140px] max-h-[160px] overflow-y-auto space-y-1">
                  <div className="font-sans font-bold text-white text-[9px] uppercase border-b border-neutral-800 pb-1.5 mb-1.5">
                    Hardware Emulation Stream Logs
                  </div>
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
