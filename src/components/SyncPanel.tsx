import React, { useState, useEffect } from 'react';
import { syncService, SyncStats, SyncLog, DiagnosticResult } from '../services/syncService';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Database,
  Wifi, 
  WifiOff,
  Clock,
  Sparkles,
  Info,
  Laptop,
  Activity,
  Wrench,
  Server,
  AlertOctagon,
  Terminal,
  ShieldCheck,
  Check,
  X,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SyncPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncPanel: React.FC<SyncPanelProps> = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState<SyncStats>(syncService.getStats());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncUrl, setSyncUrl] = useState(syncService.getBaseUrl());
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  useEffect(() => {
    // Subscribe to sync service updates
    const unsubscribe = syncService.addListener((newStats) => {
      setStats(newStats);
    });

    const handleSyncComplete = () => {
      setIsSyncing(false);
    };

    window.addEventListener('sync-completed', handleSyncComplete);

    return () => {
      unsubscribe();
      window.removeEventListener('sync-completed', handleSyncComplete);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await syncService.syncNow(true);
    setIsSyncing(false);
  };

  const handleRunDiagnostics = async () => {
    setIsTestingConnection(true);
    setShowTroubleshooting(true);
    const result = await syncService.runDiagnostics();
    setDiagnosticResult(result);
    setIsTestingConnection(false);
  };

  if (!isOpen) return null;

  const lastError = syncService.getLastConnectionError();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-card border border-border rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-border flex items-center justify-between bg-gradient-to-r from-indigo-50/60 to-violet-50/60 dark:from-indigo-950/30 dark:to-violet-950/30">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20">
                <Database className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-ink uppercase">DMi POS Cloud-Sync Diagnostic Center</h3>
                <p className="text-xs text-muted">Real-Time Connectivity, Gateway Diagnostics & Local Offline Standalone Engine</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-xl text-muted hover:text-ink transition-colors font-bold text-xs uppercase"
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Main Status & Connectivity Banner */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Online Connection Status */}
              <div className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                stats.isOnline 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-300' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-300'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Cloud Ingress Status</span>
                  {stats.isOnline ? <Wifi className="w-5 h-5 text-emerald-500" /> : <WifiOff className="w-5 h-5 text-rose-500" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${stats.isOnline ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
                    <span className="text-xl font-black tracking-tight">
                      {stats.isOnline ? 'ONLINE (Cloud Active)' : 'OFFLINE (Local Standalone)'}
                    </span>
                  </div>
                  <p className="text-xs opacity-90 mt-1 leading-relaxed">
                    {stats.isOnline 
                      ? 'Terminal syncing is active. Transactions sync centrally in real time.' 
                      : 'Server connection unreachable. Operating 100% safely in Local-First Mode.'}
                  </p>
                </div>
              </div>

              {/* Offline Queue */}
              <div className="p-5 rounded-2xl border border-border bg-card/60 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted">Offline Cache Ledger</span>
                  <Cloud className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <span className="text-2xl font-black text-ink">
                    {stats.pendingCount} record{stats.pendingCount !== 1 ? 's' : ''} queued
                  </span>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    {stats.pendingCount > 0 
                      ? 'Transactions waiting for connection recovery.' 
                      : 'All sales and inventory updates are completely synced.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Unreachable Server Warning Banner if Offline */}
            {(!stats.isOnline || lastError) && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs space-y-3">
                <div className="flex items-start gap-3">
                  <AlertOctagon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <div className="font-black text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                      Server Connection Diagnostic Warning
                    </div>
                    <p className="text-ink text-xs leading-relaxed font-mono">
                      {lastError || 'Unable to establish HTTP REST API handshake with configured Gateway URL.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-500/20">
                  <button
                    onClick={handleRunDiagnostics}
                    disabled={isTestingConnection}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Activity className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
                    <span>{isTestingConnection ? 'Testing Gateway...' : 'Test Connection Diagnostics'}</span>
                  </button>

                  <button
                    onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                    className="px-3 py-1.5 bg-card hover:bg-muted text-ink border border-border font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                  >
                    <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{showTroubleshooting ? 'Hide Steps' : 'Troubleshooting Steps'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Diagnostic Results Card */}
            {diagnosticResult && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 text-xs text-white">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    <span className="font-black uppercase tracking-wider text-xs">Diagnostic Report Results</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    diagnosticResult.overallStatus === 'ONLINE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {diagnosticResult.overallStatus}
                  </span>
                </div>

                <div className="space-y-2 font-mono">
                  {diagnosticResult.steps.map((step, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex items-start gap-3">
                      <div className="mt-0.5">
                        {step.status === 'PASS' && <Check className="w-4 h-4 text-emerald-400" />}
                        {step.status === 'WARN' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                        {step.status === 'FAIL' && <X className="w-4 h-4 text-rose-400" />}
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span>{step.name}</span>
                          {step.latencyMs !== undefined && (
                            <span className="text-[10px] text-slate-400">{step.latencyMs}ms</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300 font-sans">{step.message}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Targeted Troubleshooting Guidance */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2 font-sans">
                  <div className="font-bold text-amber-400 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                    <Wrench className="w-3.5 h-3.5" /> Actionable Troubleshooting Recommendations:
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs leading-relaxed">
                    {diagnosticResult.troubleshootingSteps.map((tb, i) => (
                      <li key={i}>{tb}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* General Troubleshooting Step-by-Step Guide */}
            {showTroubleshooting && !diagnosticResult && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4 text-xs">
                <div className="font-black text-ink uppercase tracking-wider flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-indigo-500" />
                  Actionable Connectivity Troubleshooting Steps
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-muted rounded-xl border border-border space-y-1">
                    <div className="font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                      1. Check Server Gateway URL Target
                    </div>
                    <p className="text-muted text-xs leading-relaxed">
                      Make sure your configured URL points to a live Supabase REST API server (e.g., <code className="bg-card px-1 py-0.5 rounded border border-border text-indigo-500 font-mono">https://&lt;project-id&gt;.supabase.co</code>) or a valid Express REST server endpoint, NOT a static web frontend host like <code className="bg-card px-1 py-0.5 rounded border border-border text-rose-500 font-mono">.netlify.app</code> or <code className="bg-card px-1 py-0.5 rounded border border-border text-rose-500 font-mono">.vercel.app</code>.
                    </p>
                  </div>

                  <div className="p-3 bg-muted rounded-xl border border-border space-y-1">
                    <div className="font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                      2. Local Wi-Fi Router & Firewall Settings
                    </div>
                    <p className="text-muted text-xs leading-relaxed">
                      Verify local Wi-Fi adapter is active. If running a local gateway on LAN, check that your local server machine allows incoming connections on port 3000 and that CORS headers are configured.
                    </p>
                  </div>

                  <div className="p-3 bg-muted rounded-xl border border-border space-y-1">
                    <div className="font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                      3. Local-First Standalone Mode Assurance
                    </div>
                    <p className="text-muted text-xs leading-relaxed">
                      Even when completely offline, DMi POS caches all sales, receipts, stock transfers, and employee attendance directly into browser local storage / IndexedDB. You can serve cashiers and issue eTIMS receipts without interruption!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sync Gateway URL Config & Quick Presets */}
            <div className="p-5 rounded-2xl border border-border bg-card/40 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-indigo-500" />
                  Cloud Sync Gateway Server Endpoint URL
                </span>
                {syncService.getBaseUrl() !== window.location.origin && (
                  <button 
                    onClick={() => {
                      syncService.setBaseUrl('');
                      setSyncUrl(syncService.getBaseUrl());
                    }} 
                    className="text-[10px] text-indigo-500 hover:text-indigo-600 font-black uppercase tracking-wider transition-colors"
                  >
                    Reset Default
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://your-cloud-api-domain.com"
                  className="flex-1 px-4 py-2.5 bg-muted text-ink border border-border rounded-xl text-xs outline-none focus:border-indigo-500 font-mono font-medium"
                  value={syncUrl}
                  onChange={(e) => setSyncUrl(e.target.value)}
                />
                <button
                  onClick={() => {
                    syncService.setBaseUrl(syncUrl);
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors shrink-0 uppercase tracking-wider shadow-sm"
                >
                  Save URL
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] text-muted font-bold uppercase">Quick URL Presets:</span>
                <button
                  onClick={() => {
                    const preset = 'http://localhost:3000';
                    setSyncUrl(preset);
                    syncService.setBaseUrl(preset);
                  }}
                  className="px-2.5 py-1 bg-muted hover:bg-card border border-border rounded-lg text-[10px] font-mono font-bold text-indigo-500 transition-colors"
                >
                  Localhost (3000)
                </button>

                <button
                  onClick={() => {
                    const preset = import.meta.env.VITE_SUPABASE_URL || 'https://kayb6z7vprmlkln2iwpxb5.supabase.co';
                    setSyncUrl(preset);
                    syncService.setBaseUrl(preset);
                  }}
                  className="px-2.5 py-1 bg-muted hover:bg-card border border-border rounded-lg text-[10px] font-mono font-bold text-emerald-500 transition-colors"
                >
                  Supabase Cloud API
                </button>
              </div>
            </div>

            {/* Action Buttons: Diagnostic Test & Manual Sync */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleRunDiagnostics}
                disabled={isTestingConnection}
                className="py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Activity className={`w-4 h-4 text-indigo-400 ${isTestingConnection ? 'animate-spin' : ''}`} />
                <span>{isTestingConnection ? 'Running Diagnostics...' : 'Test Connection'}</span>
              </button>

              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className={`py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
                  isSyncing 
                    ? 'bg-muted cursor-not-allowed text-muted'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Synchronizing...' : 'Trigger Full Sync'}</span>
              </button>
            </div>

            {/* Sync History Logs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex-1">Sync Session & Connection Log History</h4>
                <span className="text-[10px] bg-muted px-2.5 py-1 rounded-lg text-muted font-bold font-mono">Latest 50 Logs</span>
              </div>

              <div className="border border-border rounded-2xl max-h-52 overflow-y-auto font-mono text-xs divide-y divide-border bg-card/30">
                {stats.logs.length === 0 ? (
                  <div className="p-8 text-center text-muted italic">
                    No sync events registered yet. Click Test Connection or Trigger Full Sync above.
                  </div>
                ) : (
                  stats.logs.map((log, index) => (
                    <div key={index} className="p-3 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                      <div className="mt-0.5 shrink-0">
                        {log.type === 'SUCCESS' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        {log.type === 'ERROR' && <AlertTriangle className="w-4 h-4 text-rose-500" />}
                        {log.type === 'INFO' && (
                          index === 0 && isSyncing ? (
                            <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
                          ) : (
                            <Info className="w-4 h-4 text-indigo-500" />
                          )
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-[10px] text-muted mb-0.5">
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                            log.type === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                            log.type === 'ERROR' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          }`}>{log.type}</span>
                        </div>
                        <p className="text-ink break-words font-sans">{log.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Footer details */}
          <div className="p-4 bg-muted border-t border-border text-center text-[10px] text-muted uppercase tracking-wider font-bold">
            eTIMS Signature Integration Active • Central Hybrid Offline Sync Engine
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

