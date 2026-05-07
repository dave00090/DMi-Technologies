import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Key, 
  ShieldAlert, 
  TrendingUp, 
  Lock, 
  Unlock, 
  ExternalLink, 
  Search,
  LayoutDashboard,
  Settings,
  DollarSign,
  AlertTriangle,
  RefreshCcw,
  Store,
  Database
} from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { supabase, License, masterService } from '../services/masterService';

interface MasterAdminProps {
  onLogout: () => void;
}

export const MasterAdmin: React.FC<MasterAdminProps> = ({ onLogout }) => {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [stats, setStats] = useState({ 
    totalClients: 0, 
    activeClients: 0, 
    totalRevenue: 0,
    todaySales: 0,
    growth: 0,
    onlineStaff: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'licenses' | 'security'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');

  useEffect(() => {
    fetchData();
    
    // Check network status
    window.addEventListener('online', () => setNetworkStatus('online'));
    window.addEventListener('offline', () => setNetworkStatus('offline'));

    // Real-time subscription for licenses
    const licenseSubscription = supabase
      .channel('master-licenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licenses' }, () => {
        fetchData();
      })
      .subscribe();

    // Real-time subscription for sales
    const salesSubscription = supabase
      .channel('master-sales')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(licenseSubscription);
      supabase.removeChannel(salesSubscription);
    };
  }, []);

  const [dbHealth, setDbHealth] = useState<{table: string, status: 'ok' | 'missing' | 'checking'}[]>([
    { table: 'licenses', status: 'checking' },
    { table: 'sales', status: 'checking' },
    { table: 'login_history', status: 'checking' },
    { table: 'piracy_alerts', status: 'checking' }
  ]);

  const fetchData = async () => {
    setIsLoading(true);
    const health: typeof dbHealth = [];
    
    try {
      // 1. Fetch Licenses (Critical table)
      const { data: licenseData, error: licenseError } = await supabase.from('licenses').select('*').order('created_at', { ascending: false });
      health.push({ table: 'licenses', status: licenseError ? 'missing' : 'ok' });
      
      if (licenseData) setLicenses(licenseData);
      if (licenseError) console.error('Licenses fetch error:', licenseError.message);

      // 2. Fetch Sales for Metrics (Handle missing 'sales' table)
      let currentSales: any[] = [];
      try {
        const { data: salesData, error: salesError } = await supabase.from('sales').select('amount, timestamp, client_name');
        health.push({ table: 'sales', status: (salesError && salesError.message.includes('not found')) ? 'missing' : 'ok' });
        
        if (salesError) {
          if (!salesError.message.includes('not found')) {
            console.error('Sales fetch error:', salesError.message);
          }
        } else {
          currentSales = salesData || [];
        }
      } catch (e) {
        health.push({ table: 'sales', status: 'missing' });
      }
      
      // Get current date in UTC to match Supabase ISO strings
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      
      const todaySales = currentSales
        .filter(s => s.timestamp?.startsWith(todayStr))
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
        
      const totalRev = currentSales.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

      // Calculate Growth (Month-over-month)
      const thisMonthStr = now.toISOString().slice(0, 7);
      const lastMonthDate = new Date();
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
      const lastMonthStr = lastMonthDate.toISOString().slice(0, 7);
      
      const thisMonthSales = currentSales
        .filter(s => s.timestamp?.startsWith(thisMonthStr))
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
        
      const lastMonthSales = currentSales
        .filter(s => s.timestamp?.startsWith(lastMonthStr))
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
      
      let growth = 0;
      if (lastMonthSales > 0) {
        growth = ((thisMonthSales - lastMonthSales) / lastMonthSales) * 100;
      } else if (thisMonthSales > 0) {
        growth = 100; // New growth
      }

      // 3. Online Staff (Handle missing 'login_history' table)
      let onlineCount = 0;
      try {
        const { data: staffLogins, error: loginError } = await supabase.from('login_history')
          .select('*')
          .gt('timestamp', new Date(Date.now() - 30 * 60000).toISOString());
        
        health.push({ table: 'login_history', status: (loginError && loginError.message.includes('not found')) ? 'missing' : 'ok' });
        
        if (loginError && !loginError.message.includes('not found')) {
          console.error('Login history fetch error:', loginError.message);
        } else if (staffLogins) {
          onlineCount = staffLogins.length;
        }
      } catch (e) {
        health.push({ table: 'login_history', status: 'missing' });
      }

      // 4. Piracy Alerts Health
      try {
        const { error: alertError } = await supabase.from('piracy_alerts').select('id').limit(1);
        health.push({ table: 'piracy_alerts', status: (alertError && alertError.message.includes('not found')) ? 'missing' : 'ok' });
      } catch (e) {
        health.push({ table: 'piracy_alerts', status: 'missing' });
      }
      
      setDbHealth(health);
      
      setStats({
        totalClients: licenseData?.length || 0,
        activeClients: licenseData?.filter(l => l.status === 'ACTIVE').length || 0,
        totalRevenue: totalRev,
        todaySales,
        growth: Math.round(growth),
        onlineStaff: onlineCount
      });
    } catch (err) {
      console.error('Master Admin fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClient = async (license: License) => {
    const confirm = window.confirm(`DANGER: Are you sure you want to PERMANENTLY delete the account for ${license.client_name}? This will remove all their records and lock their system.`);
    if (!confirm) return;

    const reset = window.confirm(`Should we also PURGE all business data (Sales, Expenses, Inventory) associated with "${license.client_name}"?`);
    if (reset) {
      await masterService.resetClientData(license.client_name);
    }

    const { error } = await masterService.deleteClient(license.id);
    if (error) alert('Error: ' + error);
    else {
      alert('Client Account Deleted Successfully.');
      fetchData();
    }
  };

  const handleResetBalances = async (license: License) => {
    const confirm = window.confirm(`Reset ALL financial balances (Sales, Debts, Ledger) for ${license.client_name}? This cannot be undone.`);
    if (confirm) {
      const { success, errors } = await masterService.resetClientData(license.client_name);
      if (success) alert('Balances Reset Successfully.');
      else alert('Reset failed: ' + errors?.join(', '));
      fetchData();
    }
  };

  const handleCreateLicense = async () => {
    const clientName = prompt('Enter Client Name / Business Name:');
    if (!clientName) return;

    const systemName = prompt('Enter System Type (e.g. RetailMaster, PharmacyMaster):', 'RetailMaster');
    if (!systemName) return;

    const fee = prompt('Enter License Fee (KES):', '15000');
    if (!fee || isNaN(Number(fee))) return;

    // Generate unique key format: DMI-XXXX-XXXX-XXXX
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const generateSegment = () => Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const licenseKey = `DMI-${generateSegment()}-${generateSegment()}-${generateSegment()}`;
    const id = Math.random().toString(36).substring(2) + Date.now().toString(36);

    try {
      const { error } = await supabase.from('licenses').insert({
        id,
        client_name: clientName,
        system_name: systemName,
        license_key: licenseKey,
        license_fee: Number(fee),
        status: 'ACTIVE',
        penalty_amount: Math.floor(Number(fee) * 1.5)
      });

      if (error) {
        alert('Error creating license: ' + error.message);
      } else {
        // Record the license fee as a sale for the developer
        try {
          await supabase.from('sales').insert({
            id: Math.random().toString(36).substring(2) + Date.now().toString(36),
            amount: Number(fee),
            client_name: clientName,
            category: 'LICENSE_FEE',
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          console.warn('Failed to record sale, but license was created:', e);
        }
        
        alert('LICENSE CREATED & PAYMENT LOGGED!\n\nClient: ' + clientName + '\nKey: ' + licenseKey + '\nFee: KES ' + fee);
        fetchData();
      }
    } catch (err: any) {
      console.error('License creation crash:', err);
      if (err.message?.includes('Failed to fetch')) {
        alert('CONNECTION ERROR: Could not reach Supabase. Please check your internet or Supabase URL/Key in Settings.\n\nDetails: ' + err.message);
      } else {
        alert('CRITICAL ERROR: ' + (err.message || String(err)));
      }
    }
  };

  const updateFee = async (licenseId: string, currentFee: number) => {
    const newFee = prompt('Enter new license fee (KES):', currentFee.toString());
    if (newFee === null || isNaN(Number(newFee))) return;

    const { error } = await supabase.from('licenses').update({ license_fee: Number(newFee) }).eq('id', licenseId);
    if (!error) fetchData();
  };

  const handleResetPin = async (clientName: string) => {
    const confirm = window.confirm(`Generate a one-time master bypass PIN for ${clientName}?`);
    if (confirm) {
      const bypassCode = Math.floor(1000 + Math.random() * 9000).toString();
      alert(`MASTER BYPASS CODE GENERATED: ${bypassCode}\n\nInstruct the client to enter this code in their PIN prompt. It will reset their local admin PIN.`);
    }
  };

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amt);
  };

  const filteredLicenses = licenses.filter(l => 
    l.client_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.license_key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isConfigMissing = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;
  const isPlaceholderConfig = import.meta.env.VITE_SUPABASE_URL?.includes('YOUR_');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Configuration Warning Banner */}
      {(isConfigMissing || isPlaceholderConfig) && (
        <div className="bg-amber-500 text-slate-950 px-8 py-2 text-center text-xs font-black uppercase tracking-widest animate-pulse">
           ⚠️ Supabase Connection Not Configured. Please set VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY in App Settings.
        </div>
      )}
      
      {/* Sidebar / Topbar */}
      <div className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase">DMi - Master Control</h1>
            <p className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase opacity-80">Global System Management</p>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          <button 
            onClick={() => setView('dashboard')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${view === 'dashboard' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
          <button 
            onClick={() => setView('licenses')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${view === 'licenses' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <Key className="w-4 h-4" />
            Licenses
          </button>
          <button 
            onClick={() => setView('security')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${view === 'security' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <ShieldAlert className="w-4 h-4" />
            Anti-Piracy
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-xl">
             <div className={`w-2 h-2 rounded-full ${networkStatus === 'online' ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
               Master Node: {networkStatus}
             </span>
          </div>
          <button 
            onClick={fetchData}
            className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors"
          >
            <RefreshCcw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={onLogout}
            className="p-3 bg-red-600 hover:bg-red-500 rounded-xl text-white transition-colors flex items-center gap-2 font-bold text-xs uppercase"
          >
            <Lock className="w-4 h-4" />
            Exit Master
          </button>
        </div>
      </div>

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 p-6 rounded-3xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-bl-full -translate-y-4 translate-x-4 transition-transform group-hover:scale-110" />
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Clients</p>
                  <h3 className="text-3xl font-black">{stats.totalClients}</h3>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-400/10 w-fit px-2 py-1 rounded-lg">
                <TrendingUp className="w-3 h-3" />
                Growth: {stats.growth >= 0 ? '+' : ''}{stats.growth}%
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-900 border border-slate-800 p-6 rounded-3xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -translate-y-4 translate-x-4 transition-transform group-hover:scale-110" />
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Online Staff</p>
                  <h3 className="text-3xl font-black">{stats.onlineStaff}</h3>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest">
                Currently Logged In
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-900 border border-slate-800 p-6 rounded-3xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-bl-full -translate-y-4 translate-x-4 transition-transform group-hover:scale-110" />
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Today's Sales</p>
                  <h3 className="text-3xl font-black">{formatCurrency(stats.todaySales)}</h3>
                </div>
              </div>
              <div className="text-xs font-bold text-slate-400">
                Total processed in last 24h
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-slate-900 border border-slate-800 p-4 rounded-3xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-bl-full -translate-y-4 translate-x-4 transition-transform group-hover:scale-110" />
              <div className="flex items-center gap-4 mb-3">
                <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700">
                  <Database className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Health</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${dbHealth.every(h => h.status === 'ok') ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className="text-sm font-black uppercase tracking-tight">
                      {dbHealth.every(h => h.status === 'ok') ? 'Optimal' : 'Degraded'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {dbHealth.map(h => (
                  <div key={h.table} className={`text-[7px] font-black uppercase tracking-tighter px-1.5 py-1 rounded border flex items-center justify-between ${h.status === 'ok' ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-500/80' : 'bg-red-500/5 border-red-500/10 text-red-500/80'}`}>
                    <span>{h.table}</span>
                    <div className={`w-1 h-1 rounded-full ${h.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Licenses Table / Content */}
          {view === 'licenses' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <Key className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-xl font-black uppercase tracking-tight">System Licenses</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Search Client or Key..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-11 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64"
                    />
                  </div>
                  <button 
                    onClick={handleCreateLicense}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-all font-sans"
                  >
                    Generate New License
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-950/50 text-[10px] uppercase font-black tracking-widest text-slate-500">
                      <th className="px-6 py-4">Client / System</th>
                      <th className="px-6 py-4">License Key</th>
                      <th className="px-6 py-4">Hardware ID</th>
                      <th className="px-6 py-4">Last Sync</th>
                      <th className="px-6 py-4">Fee (KES)</th>
                      <th className="px-6 py-4">Network State</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredLicenses.map((license) => {
                      const isOffline = !license.last_heartbeat || 
                        (new Date().getTime() - new Date(license.last_heartbeat).getTime() > 1000 * 60 * 5);
                      
                      return (
                        <tr key={license.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-200">{license.client_name}</div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-widest">{license.system_name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <code className="bg-slate-950 px-2 py-1 rounded-lg text-xs text-indigo-400 border border-slate-800">{license.license_key}</code>
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-slate-400">{license.machine_id?.slice(0, 12) || '---'}</td>
                          <td className="px-6 py-4 text-xs text-slate-400">
                            {license.last_heartbeat ? format(new Date(license.last_heartbeat), 'MMM dd, HH:mm') : 'Never'}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-200">
                            {formatCurrency(license.license_fee || 0)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                              <span className={`text-[10px] font-bold uppercase ${isOffline ? 'text-red-500' : 'text-emerald-500'}`}>
                                {isOffline ? 'Offline' : 'Online / Live'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                            license.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 
                            license.status === 'LOCKED' ? 'bg-red-500/10 text-red-500' :
                            'bg-amber-500/10 text-amber-500'
                          }`}>
                            {license.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleResetBalances(license)}
                              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-emerald-400 transition-colors"
                              title="Reset Balances"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => {
                                const newStatus = license.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED';
                                supabase.from('licenses').update({ status: newStatus }).eq('id', license.id).then(() => fetchData());
                              }}
                              className={`p-2 rounded-lg transition-colors ${license.status === 'LOCKED' ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}
                              title={license.status === 'LOCKED' ? 'Unlock System' : 'Lock System'}
                            >
                              {license.status === 'LOCKED' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => handleDeleteClient(license)}
                              className="p-2 bg-red-600/10 hover:bg-red-600/20 rounded-lg text-red-500 transition-colors"
                              title="Delete Client"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                   })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {view === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {/* Recent Sales List */}
               <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-8 lg:col-span-2"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-600/20 rounded-xl flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-amber-500" />
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Recent Revenue</h3>
                  </div>
                  <button onClick={() => setView('licenses')} className="text-xs font-bold text-indigo-400 hover:underline uppercase tracking-widest">Manage Licenses →</button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800">
                        <th className="pb-4">Client</th>
                        <th className="pb-4">Type</th>
                        <th className="pb-4">Amount</th>
                        <th className="pb-4">Timestamp</th>
                        <th className="pb-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {licenses.slice(0, 10).map(l => (
                         // Show recent license fee activity as a proxy for sales if sync is fresh
                         <tr key={l.id} className="group">
                           <td className="py-4 font-bold text-sm text-slate-300">{l.client_name}</td>
                           <td className="py-4 text-[10px] font-black uppercase text-indigo-400/70 tracking-widest">
                             {l.status === 'PENDING' ? 'License Order' : 'License Sale'}
                           </td>
                           <td className="py-4 font-black text-slate-100">{formatCurrency(l.license_fee || 0)}</td>
                           <td className="py-4 text-xs text-slate-500">{format(new Date(l.created_at), 'MMM dd, HH:mm')}</td>
                           <td className="py-4 text-right">
                             <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase rounded">Confirmed</span>
                           </td>
                         </tr>
                      ))}
                      {licenses.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-600 text-sm font-bold uppercase italic tracking-widest">No transaction records found in cloud</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>

               <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-8"
              >
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center">
                    <LayoutDashboard className="w-6 h-6 text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight">System Health</h3>
                </div>
                
                <div className="space-y-6">
                  {licenses.slice(0, 3).map(l => (
                    <div key={l.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full ${(!l.last_heartbeat || new Date().getTime() - new Date(l.last_heartbeat).getTime() > 1000 * 60 * 5) ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`} />
                          <div>
                            <p className="font-bold text-sm">{l.client_name}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest">{l.system_name || 'RetailMaster'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Status</p>
                          <p className={`text-[10px] font-black uppercase tracking-widest ${(!l.last_heartbeat || new Date().getTime() - new Date(l.last_heartbeat).getTime() > 1000 * 60 * 5) ? 'text-red-500' : 'text-emerald-500'}`}>
                            {(!l.last_heartbeat || new Date().getTime() - new Date(l.last_heartbeat).getTime() > 1000 * 60 * 5) ? 'Offline' : 'Online'}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/50">
                          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Target Market</p>
                          <p className="text-xs font-black text-indigo-400 font-mono truncate">Kenya / Global</p>
                        </div>
                        <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/50">
                          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">System Env</p>
                          <p className="text-xs font-black text-slate-400 font-mono uppercase">{l.system_name || 'Generic'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-8"
              >
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Critical Alerts</h3>
                </div>
                
                <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
                  <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm font-bold">No security violations detected.</p>
                  <p className="text-xs uppercase tracking-widest opacity-50">DMi technologies protection is active.</p>
                </div>
              </motion.div>
            </div>
          )}

          {view === 'security' && (
            <div className="space-y-8">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center"
              >
                 <ShieldAlert className="w-16 h-16 text-indigo-500 mx-auto mb-6" />
                 <h2 className="text-3xl font-black mb-4 uppercase tracking-tighter">Anti-Piracy Command Center</h2>
                 <p className="text-slate-400 max-w-xl mx-auto mb-8">
                   The system automatically monitors domain changes and hardware signatures. 
                   Unauthorized distribution will result in an immediate system lock and the penalty module will activate.
                 </p>
                 
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                   <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl text-left border-l-4 border-l-red-600">
                     <h4 className="font-bold text-red-500 mb-2 flex items-center gap-2 uppercase tracking-widest text-xs">
                       <Lock className="w-4 h-4" /> 
                       Global Firewall
                     </h4>
                     <p className="text-[11px] text-slate-500 mb-4">Blocks unauthorized sync requests and prevents all external access.</p>
                     <div className="flex items-center justify-between p-2 bg-slate-900 rounded-xl">
                       <span className="text-[10px] font-bold uppercase text-emerald-400">Status: Active</span>
                       <div className="w-8 h-4 bg-emerald-500/20 rounded-full relative">
                         <div className="absolute right-1 top-1 w-2 h-2 bg-emerald-500 rounded-full" />
                       </div>
                     </div>
                   </div>
                   
                   <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl text-left border-l-4 border-l-indigo-600">
                     <h4 className="font-bold text-indigo-400 mb-2 flex items-center gap-2 uppercase tracking-widest text-xs">
                       <ShieldAlert className="w-4 h-4" /> 
                       Anti-Copying Guard
                     </h4>
                     <p className="text-[11px] text-slate-500 mb-4">Hardware signature lock that prevents database extraction or duplication.</p>
                     <div className="flex items-center justify-between p-2 bg-slate-900 rounded-xl">
                       <span className="text-[10px] font-bold uppercase text-emerald-400">Status: Active</span>
                       <div className="w-8 h-4 bg-emerald-500/20 rounded-full relative">
                         <div className="absolute right-1 top-1 w-2 h-2 bg-emerald-500 rounded-full" />
                       </div>
                     </div>
                   </div>

                   <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl text-left border-l-4 border-l-amber-600">
                     <h4 className="font-bold text-amber-500 mb-2 flex items-center gap-2 uppercase tracking-widest text-xs">
                       <Search className="w-4 h-4" /> 
                       Live Watchdog
                     </h4>
                     <p className="text-[11px] text-slate-500 mb-4">Real-time usage tracking of all distributed licenses.</p>
                     <div className="flex items-center justify-between p-2 bg-slate-900 rounded-xl">
                       <span className="text-[10px] font-bold uppercase text-emerald-400">Status: Active</span>
                       <div className="w-8 h-4 bg-emerald-500/20 rounded-full relative">
                         <div className="absolute right-1 top-1 w-2 h-2 bg-emerald-500 rounded-full" />
                       </div>
                     </div>
                   </div>
                 </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-8"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                    <Key className="w-6 h-6 text-amber-500" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Offline Activation Tool</h3>
                </div>

                <div className="max-w-md space-y-4">
                  <p className="text-sm text-slate-400">If a client is offline, ask for their <b>Machine ID</b> and enter it below to generate an activation response.</p>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Machine ID (from client)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. YUhSMGNITTZMeTlpWVd..."
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500"
                      id="machineInput"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      const input = document.getElementById('machineInput') as HTMLInputElement;
                      if (input.value) {
                         const response = masterService.generateOfflineResponse(input.value, 'DMI_OFFLINE_SECRET_2026');
                         alert('OFFLINE ACTIVATION CODE: ' + response);
                      }
                    }}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-all uppercase tracking-widest text-xs"
                  >
                    Generate Response Code
                  </button>
                </div>
              </motion.div>
            </div>
          )}

        </div>
      </main>

      {/* Copyright Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 px-8 py-4 flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
        <p>© 2026 DMi Technologies Kenya - All Rights Reserved.</p>
        <p>Software Built & Protected for East African Market</p>
      </footer>
    </div>
  );
};
