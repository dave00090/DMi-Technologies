import React, { useState, useEffect } from 'react';
import { syncService, SyncStats, SyncLog } from '../services/syncService';
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
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SyncPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncPanel: React.FC<SyncPanelProps> = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState<SyncStats>(syncService.getStats());
  const [isSyncing, setIsSyncing] = useState(false);

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
    const success = await syncService.syncNow();
    setIsSyncing(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-card border border-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-border flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-violet-50/50 dark:from-indigo-950/20 dark:to-violet-950/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl">
                <Database className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-ink">SimbaPOS Hybrid Cloud-Sync Monitor</h3>
                <p className="text-xs text-muted">Distributed Branch Sync & Offline Terminal Cache</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-muted rounded-lg text-muted hover:text-ink transition-colors"
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Status Section */}
            <div className="grid grid-cols-2 gap-4">
              {/* Online Check */}
              <div className={`p-4 rounded-xl border flex flex-col justify-between h-28 transition-all ${
                stats.isOnline 
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-900 dark:text-emerald-400' 
                  : 'bg-rose-500/5 border-rose-500/20 text-rose-900 dark:text-rose-400'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider opacity-80">Cloud Ingress Connection</span>
                  {stats.isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5 text-rose-500" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${stats.isOnline ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
                    <span className="text-lg font-black tracking-tight">
                      {stats.isOnline ? 'ONLINE (Cloud Mode)' : 'OFFLINE (Local Mode)'}
                    </span>
                  </div>
                  <p className="text-xs opacity-80 mt-1">
                    {stats.isOnline 
                      ? 'Terminal syncing is active. Stock levels sync globally.' 
                      : 'Internet connection is cut. Terminal is caching transactions local.'}
                  </p>
                </div>
              </div>

              {/* Cache Stats */}
              <div className="p-4 rounded-xl border border-border bg-card flex flex-col justify-between h-28">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Offline Cache Queue</span>
                  <Cloud className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <span className="text-xl font-black text-ink">
                    {stats.pendingCount} record{stats.pendingCount !== 1 ? 's' : ''} queued
                  </span>
                  <p className="text-xs text-muted mt-1">
                    {stats.pendingCount > 0 
                      ? 'Pending cloud upload once internet resumes.' 
                      : 'All sales and stock adjustments are fully backed up.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Sync Summary Row */}
            <div className="p-4 rounded-xl bg-muted border border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-muted">
                <Clock className="w-4 h-4" />
                <span>Last Synced:</span>
                <span className="font-bold text-ink">
                  {stats.lastSyncTime ? new Date(stats.lastSyncTime).toLocaleString() : 'Never synced yet'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-sync every 30s</span>
              </div>
            </div>

            {/* Action Trigger */}
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg transition-all ${
                isSyncing 
                  ? 'bg-muted cursor-not-allowed text-muted'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20 hover:scale-[1.01]'
              }`}
            >
              <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronizing Cloud Database...' : 'Trigger Full Sync (Pull & Push)'}</span>
            </button>

            {/* Sync History Logs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex-1">Sync Session History Details</h4>
                <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted font-bold">Logs</span>
              </div>
              <div className="border border-border rounded-xl max-h-56 overflow-y-auto font-mono text-xs divide-y divide-border">
                {stats.logs.length === 0 ? (
                  <div className="p-8 text-center text-muted">
                    No sync events registered yet. Click sync above.
                  </div>
                ) : (
                  stats.logs.map((log, index) => (
                    <div key={index} className="p-3 flex items-start gap-3 bg-muted/30">
                      <div className="mt-0.5">
                        {log.type === 'SUCCESS' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        {log.type === 'ERROR' && <AlertTriangle className="w-4 h-4 text-rose-500" />}
                        {log.type === 'INFO' && <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-[10px] text-muted mb-0.5">
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                          <span className={`px-1 rounded text-[8px] font-bold ${
                            log.type === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-600' :
                            log.type === 'ERROR' ? 'bg-rose-500/10 text-rose-600' : 'bg-indigo-500/10 text-indigo-600'
                          }`}>{log.type}</span>
                        </div>
                        <p className="text-ink break-words">{log.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Footer details of eTIMS / SimbaPOS */}
          <div className="p-4 bg-muted border-t border-border text-center text-[10px] text-muted uppercase tracking-wider">
            eTIMS Signature Integration Enabled • Nairobi Server Gateway
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
