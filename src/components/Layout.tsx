import React from 'react';
import { UserProfile } from '../types';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Bell, 
  Settings,
  Menu,
  X,
  Clock,
  Shield,
  Users,
  Palette,
  BarChart3,
  Receipt,
  Truck,
  UserCheck,
  History,
  Cloud,
  CloudOff,
  FileText,
  HeartHandshake,
  Wifi,
  WifiOff,
  RefreshCw,
  Laptop
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { BRAND_LOGO_URL, DMI_FALLBACK_ICON } from '../constants';

import { SafeImage } from './SafeImage';
import { syncService } from '../services/syncService';
import { SyncPanel } from './SyncPanel';

interface LayoutProps {
  user: UserProfile | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
  unreadAlerts: number;
  businessName: string;
  businessLogo?: string;
  shopName: string;
  authComponent: React.ReactNode;
  onExitBusiness: () => void;
  businessType?: string;
}

export const Layout: React.FC<LayoutProps> = ({ 
  user, 
  activeTab, 
  setActiveTab, 
  children,
  unreadAlerts,
  businessName,
  businessLogo,
  shopName,
  authComponent,
  onExitBusiness,
  businessType
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(window.innerWidth > 1024);
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [isSyncOpen, setIsSyncOpen] = React.useState(false);
  const [syncStats, setSyncStats] = React.useState({ isOnline: navigator.onLine, pendingCount: 0 });
  const [isSyncing, setIsSyncing] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = syncService.addListener((stats) => {
      setSyncStats({ isOnline: stats.isOnline, pendingCount: stats.pendingCount });
    });
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const handleResize = () => {
      if (window.innerWidth <= 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const [logoClicks, setLogoClicks] = React.useState(0);

  const handleLogoClick = () => {
    setLogoClicks(prev => prev + 1);
    setTimeout(() => setLogoClicks(0), 3000); // Reset after 3 seconds
    
    if (logoClicks + 1 >= 5) {
      setActiveTab('master-admin');
      setLogoClicks(0);
    }
  };

  const navItems = [
    { id: 'pos', label: 'Sales POS', icon: ShoppingCart, roles: ['admin', 'staff'] },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'] },
    { id: 'inventory', label: 'Inventory', icon: Package, roles: ['admin', 'staff'] },
    { id: 'invoices', label: 'Invoices', icon: FileText, roles: ['admin', 'staff'] },
    ...(businessType === 'HOTEL' ? [
      { id: 'guest-requests', label: 'Guest Desk', icon: HeartHandshake, roles: ['admin', 'staff'] }
    ] : []),
    { id: 'expenses', label: 'Expenses', icon: Receipt, roles: ['admin'] },
    { id: 'suppliers', label: 'Suppliers', icon: Truck, roles: ['admin'] },
    { id: 'hrm', label: 'HRM', icon: UserCheck, roles: ['admin', 'hr'] },
    { id: 'ledger', label: 'Ledger', icon: History, roles: ['admin'] },
    { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['admin'] },
    { id: 'customers', label: 'Customers', icon: Users, roles: ['admin'] },
    { id: 'alerts', label: 'Alerts', icon: Bell, roles: ['admin'], badge: unreadAlerts },
    { id: 'settings', label: 'Settings', icon: Palette, roles: ['admin'] },
  ];

  const filteredNav = user ? navItems.filter(item => item.roles.includes(user.role)) : [];

  return (
    <div className="flex min-h-screen bg-bg text-ink transition-colors duration-300">
      {/* Sidebar Overlay (Mobile) */}
      <AnimatePresence>
        {isSidebarOpen && window.innerWidth <= 1024 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[45] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 280 : 80,
          x: (window.innerWidth <= 1024 && !isSidebarOpen) ? -80 : 0,
          left: (window.innerWidth <= 1024 && !isSidebarOpen) ? -280 : 0
        }}
        className={`fixed top-0 h-full bg-card border-r border-border text-ink z-50 flex flex-col transition-colors duration-300 print:hidden ${
          window.innerWidth <= 1024 ? 'shadow-2xl' : ''
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          {(isSidebarOpen || window.innerWidth <= 1024) && (
            <motion.div 
              initial={false}
              animate={{ opacity: isSidebarOpen ? 1 : 0 }}
              className="flex items-center gap-3 overflow-hidden cursor-pointer active:scale-95 transition-transform"
              onClick={handleLogoClick}
            >
              <SafeImage 
                src={businessLogo} 
                alt="Logo" 
                className="w-10 h-10 rounded-xl object-contain bg-white border border-border flex-shrink-0" 
                fallback={
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-white font-black text-xl overflow-hidden border border-border flex-shrink-0">
                    <img src={BRAND_LOGO_URL} alt="DMi" className="w-full h-full object-contain" onError={(e) => {
                      e.currentTarget.src = DMI_FALLBACK_ICON;
                    }} />
                  </div>
                }
                referrerPolicy="no-referrer" 
              />
              {isSidebarOpen && (
                <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent truncate">
                  DMi Technologies
                </span>
              )}
            </motion.div>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-muted rounded-lg transition-colors flex-shrink-0"
          >
            {isSidebarOpen ? <X className="w-5 h-5 text-muted" /> : <Menu className="w-5 h-5 text-muted" />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto custom-scrollbar">
          {filteredNav.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (window.innerWidth <= 1024) setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-muted hover:text-ink hover:bg-muted'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {isSidebarOpen && (
                <span className="font-medium whitespace-nowrap flex-1 text-left">
                  {item.label}
                </span>
              )}
              {isSidebarOpen && item.badge !== undefined && item.badge > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <button
            onClick={onExitBusiness}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all ${!isSidebarOpen ? 'justify-center' : ''}`}
            title="Exit Business"
          >
            <X className="w-5 h-5 flex-shrink-0" />
            {isSidebarOpen && <span className="font-bold text-sm text-left flex-1">Exit Business</span>}
          </button>

          <div className={`flex items-center gap-3 ${isSidebarOpen ? 'px-2' : 'justify-center'}`}>
            <Clock className="w-5 h-5 text-muted flex-shrink-0" />
            {isSidebarOpen && (
              <div className="text-xs font-mono text-muted">
                {format(currentTime, 'HH:mm:ss')}
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main 
        className="flex-1 transition-all duration-300 print:!ml-0 min-w-0"
        style={{ marginLeft: window.innerWidth > 1024 ? (isSidebarOpen ? 280 : 80) : 0 }}
      >
        <header className="h-20 bg-card border-b border-border px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40 transition-colors duration-300 print:hidden">
          <div className="flex items-center gap-4">
            {window.innerWidth <= 1024 && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-muted rounded-lg transition-colors border border-border"
              >
                <Menu className="w-5 h-5 text-ink" />
              </button>
            )}
            <div className="flex flex-col">
              <h2 className="text-lg sm:text-xl font-black text-ink capitalize leading-tight truncate max-w-[150px] sm:max-w-none">
                {(!user || activeTab === 'dashboard') ? 'DMi Tech' : activeTab.replace('-', ' ')}
              </h2>
              {user && (
                <div className="flex items-center gap-1 sm:gap-2 text-[9px] sm:text-[10px] font-bold text-muted uppercase tracking-widest truncate">
                  <span className="text-indigo-600 truncate max-w-[80px] sm:max-w-none">{businessName}</span>
                  <span className="opacity-30">•</span>
                  <span className="truncate max-w-[80px] sm:max-w-none">{shopName}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {user && (
              <div className="flex items-center gap-2 sm:gap-3 bg-muted/30 p-1 rounded-2xl border border-border">
                {/* 1. WIFI SIGN STATUS INDICATOR */}
                <div 
                  className={`p-2 rounded-xl flex items-center gap-2 transition-all text-xs font-bold leading-none ${
                    syncStats.isOnline 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10' 
                      : 'bg-neutral-500/10 text-neutral-400 dark:text-neutral-500 border border-neutral-500/10'
                  }`}
                  title={syncStats.isOnline ? "System is Online & Connected to Cloud" : "System is Offline (Transactions are Cached Perfectly)"}
                >
                  <span className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      syncStats.isOnline ? 'bg-emerald-500' : 'bg-neutral-400'
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                      syncStats.isOnline ? 'bg-emerald-600' : 'bg-neutral-500'
                    }`}></span>
                  </span>
                  {syncStats.isOnline ? (
                    <Wifi className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-neutral-400" />
                  )}
                  <span className="hidden sm:inline-block">
                    {syncStats.isOnline ? "Online" : "Offline"}
                  </span>
                </div>

                {/* 2. MANUAL INSTANT SYNC BUTTON */}
                <button
                  onClick={async () => {
                    setIsSyncing(true);
                    await syncService.syncNow(true);
                    setIsSyncing(false);
                  }}
                  disabled={isSyncing}
                  className={`px-3 py-2 rounded-xl border flex items-center gap-2 h-9 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer ${
                    isSyncing 
                      ? 'bg-indigo-50/10 text-indigo-500 border-indigo-200 animate-pulse'
                      : 'bg-card text-ink border-border hover:bg-muted font-bold text-xs'
                  }`}
                  title="Force Instant Database Backup & Sync"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </span>
                  {syncStats.pendingCount > 0 && (
                    <span className="bg-rose-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded-lg flex items-center justify-center min-w-4 h-4 aspect-square animate-bounce">
                      {syncStats.pendingCount}
                    </span>
                  )}
                </button>

                {/* 3. SYNC MONITOR PANEL TOGGLE */}
                <button
                  onClick={() => setIsSyncOpen(true)}
                  className="px-3 py-2 hover:bg-muted rounded-xl text-xs font-bold text-muted hover:text-ink transition-colors cursor-pointer"
                  title="Configure Cloud Sync Gateway and view Sync Logs"
                >
                  Configure
                </button>
              </div>
            )}
            <div className="hidden lg:block text-right mr-4">
              <p className="text-sm font-medium text-muted">
                {format(currentTime, 'EEEE, MMMM do')}
              </p>
            </div>
            {authComponent}
          </div>
        </header>

        <div className="p-4 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
              <div className="mt-8 pt-8 border-t border-border flex justify-center">
                <p className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] opacity-50">
                  © {new Date().getFullYear()} <span className="text-indigo-600">DMi Technologies</span> • Premium POS System
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <SyncPanel isOpen={isSyncOpen} onClose={() => setIsSyncOpen(false)} />
    </div>
  );
};
