/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { POS } from './components/POS';
import { Inventory } from './components/Inventory';
import { Dashboard } from './components/Dashboard';
import { Customers } from './components/Customers';
import { Settings } from './components/Settings';
import { Reports } from './components/Reports';
import { Expenses } from './components/Expenses';
import { Suppliers } from './components/Suppliers';
import { HRM } from './components/HRM';
import { Ledger } from './components/Ledger';
import { UserProfile, Alert, BusinessProfile, Shop } from './types';
import { localDb } from './services/localDb';
import { localAuth } from './services/localAuth';
import { backupEngine } from './services/backupEngine';
import { createPortal } from 'react-dom';

import { ErrorBoundary } from './components/ErrorBoundary';
import { BusinessSelector } from './components/BusinessSelector';
import { ShopSelector } from './components/ShopSelector';
import { ActivationScreen } from './components/ActivationScreen';
import { InstallPrompt } from './components/InstallPrompt';

import { MasterAdmin } from './components/MasterAdmin';
import { MasterLogin } from './components/MasterLogin';
import { PenaltyScreen } from './components/PenaltyScreen';
import { SubscriptionLockScreen } from './components/SubscriptionLockScreen';
import { masterService, supabase } from './services/masterService';
import { syncService } from './services/syncService';
import { dmiDataEngine } from './services/dmiDataEngine';

import { InvoicesTab } from './components/InvoicesTab';
import { GuestDeskPanel } from './components/GuestDeskPanel';
import { GuestPortal } from './components/GuestPortalView';
import { StandalonePrintPage } from './components/StandalonePrintPage';

import { UserCheck, HeartHandshake, Shield } from 'lucide-react';

export default function App() {
  const [isActivated, setIsActivated] = useState(localDb.isActivated());
  const [isSystemLocked, setIsSystemLocked] = useState(false);
  const [isMasterMode, setIsMasterMode] = useState(false);
  const [showMasterLogin, setShowMasterLogin] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(localAuth.getCurrentUser());
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(localDb.getActiveBusinessId());
  const [activeShopId, setActiveShopId] = useState<string | null>(localDb.getActiveShopId());
  const [activeTab, setActiveTab] = useState('pos');
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    try {
      return parseFloat(localStorage.getItem('dmi_pos_zoom_level') || '1');
    } catch (e) {
      return 1;
    }
  });
  const [ledgerSelection, setLedgerSelection] = useState<{ id: string, type: 'CUSTOMER' | 'SUPPLIER' } | null>(null);
  const [businessUpdateCounter, setBusinessUpdateCounter] = useState(0);

  const handleGoToBilling = () => {
    // Billing removed
  };

  const handleViewLedger = (id: string, type: 'CUSTOMER' | 'SUPPLIER') => {
    setLedgerSelection({ id, type });
    setActiveTab('ledger');
  };
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [isSubscriptionExpired, setIsSubscriptionExpired] = useState(false);
  const [licenseExpiryDate, setLicenseExpiryDate] = useState<string | null>(null);
  const [licensePlan, setLicensePlan] = useState<string | null>(() => {
    try {
      const key = localStorage.getItem('dmi_pos_license_key');
      if (key) {
        const cacheKey = `dmi_license_cache_${key}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const decrypted = JSON.parse(atob(cached));
            return decrypted?.data?.plan_type || null;
          } catch (e) {
            try {
              const direct = JSON.parse(cached);
              return direct?.data?.plan_type || null;
            } catch (inner) {}
          }
        }
      }
    } catch (e) {}
    return null;
  });

  useEffect(() => {
    localDb.vacuum();
    
    // Auto backup & 3-year data retention compliance check
    try {
      backupEngine.checkAndRunScheduledBackup();
      backupEngine.purgeDataOlderThanThreeYears();
    } catch (e) {
      console.warn('Backup or purge failed on startup:', e);
    }

    const isActivatedLocally = localDb.isActivated();
    
    // License Heartbeat & Anti-Piracy Check
    const checkLicense = async () => {
      if (!isActivatedLocally) return;

      const licenseKey = localStorage.getItem('dmi_pos_license_key');
      if (licenseKey) {
        const fingerPrint = await getMachineFingerprint();
        const domain = window.location.hostname;
        
        const result = await masterService.verifyLicense(licenseKey, fingerPrint, domain);
        if (!result.success) {
          if (result.isSubscriptionExpired) {
            setIsSubscriptionExpired(true);
            if (result.data) {
              if (result.data.expires_at) setLicenseExpiryDate(result.data.expires_at);
              setLicensePlan(result.data.plan_type);
            }
          } else if ((result as any).isLocked || (result as any).securityBreach) {
            setIsSystemLocked(true);
            // If explicitly revoked by server, we should also deactivate local trigger
            if (result.message?.includes('Revoked') || result.message?.includes('Deleted')) {
              await localDb.deactivate();
              setIsActivated(false);
            }
          }
        } else {
          setIsSubscriptionExpired(false);
          setIsSystemLocked(false);
          if (result.data) {
            setLicenseExpiryDate(result.data.expires_at);
            setLicensePlan(result.data.plan_type);
            const targetBizId = result.data.business_id || result.data.id;
            if (targetBizId && targetBizId !== activeBusinessId) {
              localDb.setActiveBusinessId(targetBizId);
              setActiveBusinessId(targetBizId);
            }
          }
          syncService.syncNow();
        }
      }
    };

    // Only skip master mode check if strictly requested or in specific environments
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('master_access') === import.meta.env.VITE_MASTER_ADMIN_SECRET) {
      setIsMasterMode(true);
    }

    checkLicense();
    
    // Initialize 24-hour automated backup scheduler (creates "DMi Backup" folder immediately on installation & every 24hrs)
    dmiDataEngine.initializeAutoBackupScheduler();
    
    // Real-time License Tracking for immediate lock/unlock
    const licenseKey = localStorage.getItem('dmi_pos_license_key');
    let subscription: { unsubscribe: () => void } | null = null;
    
    if (licenseKey && isActivatedLocally) {
      subscription = supabase
        .channel(`license-watch-${licenseKey.slice(0, 8)}`)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'licenses',
            filter: `license_key=eq.${licenseKey}`
          }, 
          (payload) => {
            if (payload.eventType === 'DELETE') {
              setIsSystemLocked(true);
              localDb.deactivate();
              setIsActivated(false);
            } else if (payload.eventType === 'UPDATE') {
              const newStatus = payload.new.status;
              const expiresAt = payload.new.expires_at;
              const newPlan = payload.new.plan_type;

              if (newPlan) {
                setLicensePlan(newPlan);
              }

              if (expiresAt) {
                const expiry = new Date(expiresAt);
                if (expiry > new Date()) {
                  setIsSubscriptionExpired(false);
                } else {
                  setIsSubscriptionExpired(true);
                  setLicenseExpiryDate(expiresAt);
                }
              } else {
                setIsSubscriptionExpired(false);
              }

              if (newStatus === 'LOCKED') {
                setIsSystemLocked(true);
              } else if (newStatus === 'ACTIVE') {
                setIsSystemLocked(false);
                if (expiresAt && new Date(expiresAt) < new Date()) {
                  setIsSubscriptionExpired(true);
                } else {
                  setIsSubscriptionExpired(false);
                }
              }
            }
          }
        )
        .subscribe();
    }

    const interval = setInterval(checkLicense, 1000 * 60 * 60); // Every hour
    return () => {
      clearInterval(interval);
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const getMachineFingerprint = async () => {
     // Simple fingerprint using user agent and screen
     return btoa(navigator.userAgent + screen.width + screen.height).slice(0, 32);
  };

  const activeBusiness = activeBusinessId ? localDb.getBusinessById(activeBusinessId) : null;
  const activeShop = activeShopId ? localDb.getShopById(activeShopId) : null;

  useEffect(() => {
    const handleAuthChange = () => {
      const currentUser = localAuth.getCurrentUser();
      setUser(currentUser);
      if (!currentUser) {
        setActiveTab('pos');
      } else if (currentUser.role === 'hr') {
        setActiveTab('hrm');
      }
    };
    window.addEventListener('auth-change', handleAuthChange);
    window.addEventListener('local-auth-change', handleAuthChange);
    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
      window.removeEventListener('local-auth-change', handleAuthChange);
    };
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      setBusinessUpdateCounter(prev => prev + 1);
    };
    window.addEventListener('local-db-update', handleUpdate);
    window.addEventListener('storage-sync', handleUpdate);
    window.addEventListener('business-update', handleUpdate);
    return () => {
      window.removeEventListener('local-db-update', handleUpdate);
      window.removeEventListener('storage-sync', handleUpdate);
      window.removeEventListener('business-update', handleUpdate);
    };
  }, []);

  // Automatic Staff Attendance Check-In on login or day start
  useEffect(() => {
    if (user && activeBusinessId && activeShopId) {
      const handleAutoCheckIn = async () => {
        if (user.role === 'staff' || user.role === 'admin') {
          const today = new Date().toISOString().split('T')[0];
          const employees = localDb.getEmployees(activeBusinessId, activeShopId);
          let employee = employees.find(e => 
            (e.email && e.email.toLowerCase() === (user.email || '').toLowerCase()) ||
            e.name.toLowerCase() === user.name.toLowerCase()
          );

          if (!employee) {
            // Register as Employee so they are listed in HRM and show in dashboards
            employee = await localDb.addEmployee({
              businessId: activeBusinessId,
              shopId: activeShopId,
              name: user.name,
              email: user.email || `${user.username}@dmipos.internal`,
              phone: '0700000000',
              role: user.role.toUpperCase(),
              salary: 15000,
              hireDate: new Date().toISOString().split('T')[0],
              status: 'ACTIVE'
            });
          }

          const attendances = localDb.getAttendance(employee.id);
          const hasTodayAttendance = attendances.some(a => a.date === today);

          if (!hasTodayAttendance) {
            await localDb.addAttendance({
              employeeId: employee.id,
              date: today,
              checkIn: new Date().toLocaleTimeString(),
              status: 'PRESENT',
              notes: 'Checked-in automatically on system login'
            });
            window.dispatchEvent(new CustomEvent('local-db-update', { detail: { key: 'dmi_pos_attendance' } }));
          }
        }
      };
      handleAutoCheckIn();
    }
  }, [user?.uid, activeBusinessId, activeShopId]);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-zoom', zoomLevel.toString());
    try {
      localStorage.setItem('dmi_pos_zoom_level', zoomLevel.toString());
    } catch (e) {}
  }, [zoomLevel]);

  useEffect(() => {
    if (user?.theme) {
      document.documentElement.style.setProperty('--primary-color', user.theme.primaryColor);
      document.documentElement.style.setProperty('--secondary-color', user.theme.secondaryColor);
      document.documentElement.style.setProperty('--accent-color', user.theme.accentColor);
      
      if (user.theme.darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [user]);

  useEffect(() => {
    if (activeBusinessId && activeShopId) {
      const updateAlerts = async () => {
        const alerts = localDb.getAlerts(activeBusinessId, activeShopId);
        
        // Check for unpaid debts older than 24 hours or past due date
        const debts = localDb.getAllDebts(activeBusinessId, activeShopId);
        const customers = await localDb.getCustomers(activeBusinessId);
        const customerMap = new Map(customers.map(c => [c.id, c.name]));
        const now = new Date();
        const twentyFourHoursMs = 24 * 60 * 60 * 1000;
        
        debts.forEach(debt => {
          if (debt.status !== 'PAID') {
            const createdMs = new Date(debt.createdAt || debt.dueDate).getTime();
            const ageMs = now.getTime() - createdMs;
            const is24hUnpaid = ageMs >= twentyFourHoursMs;
            const isPastDueDate = debt.dueDate ? new Date(debt.dueDate) <= now : false;

            if (is24hUnpaid || isPastDueDate) {
              if (debt.status !== 'OVERDUE') {
                localDb.updateDebt(debt.id, { status: 'OVERDUE' });
              }
              
              // Create alert if not already exists
              const existingAlert = alerts.find(a => a.type === 'DEBT_OVERDUE' && a.details?.debtId === debt.id);
              if (!existingAlert) {
                const custName = customerMap.get(debt.customerId) || 'Customer';
                localDb.addAlert({
                  businessId: activeBusinessId,
                  shopId: activeShopId,
                  type: 'DEBT_OVERDUE',
                  message: `Unpaid Debt Alert: ${custName} owes KSh ${debt.remainingAmount.toLocaleString()} (Unpaid for 24+ hours).`,
                  timestamp: now.toISOString(),
                  status: 'UNREAD',
                  details: { debtId: debt.id, customerId: debt.customerId, amount: debt.remainingAmount }
                });
              }
            }
          }
        });

        setUnreadAlerts(localDb.getAlerts(activeBusinessId, activeShopId).filter(a => a.status === 'UNREAD').length);
      };
      
      updateAlerts();
      const interval = setInterval(updateAlerts, 15000); // Check every 15 seconds
      return () => clearInterval(interval);
    }
  }, [user, activeBusinessId, activeShopId]);

  const handleBusinessSelect = (business: BusinessProfile) => {
    setActiveBusinessId(business.id);
    localDb.setActiveBusinessId(business.id);
  };

  const handleShopSelect = (shop: Shop) => {
    setActiveShopId(shop.id);
    localDb.setActiveShopId(shop.id);
  };

  const handleExitBusiness = () => {
    setActiveShopId(null);
    localDb.setActiveShopId(null);
    setActiveBusinessId(null);
    localDb.setActiveBusinessId(null);
  };

  const handleLogout = async () => {
    if (user && activeBusinessId && activeShopId && (user.role === 'staff' || user.role === 'admin')) {
      const today = new Date().toISOString().split('T')[0];
      const employees = localDb.getEmployees(activeBusinessId, activeShopId);
      const employee = employees.find(e => 
        (e.email && e.email.toLowerCase() === (user.email || '').toLowerCase()) ||
        e.name.toLowerCase() === user.name.toLowerCase()
      );
      if (employee) {
        const attendances = localDb.getAttendance(employee.id);
        const todayAttendance = attendances.find(a => a.date === today);
        if (todayAttendance && !todayAttendance.checkOut) {
          await localDb.deleteAttendance(todayAttendance.id);
          await localDb.addAttendance({
            ...todayAttendance,
            checkOut: new Date().toLocaleTimeString(),
            notes: 'Auto-checkout upon logout'
          });
          window.dispatchEvent(new CustomEvent('local-db-update', { detail: { key: 'dmi_pos_attendance' } }));
        }
      }
    }
    await localAuth.logout();
    setUser(null);
    handleExitBusiness();
  };

  if (isMasterMode) {
    return (
      <ErrorBoundary>
        <MasterAdmin onLogout={() => setIsMasterMode(false)} />
      </ErrorBoundary>
    );
  }

  if (isSystemLocked) {
    return <PenaltyScreen />;
  }

  if (isSubscriptionExpired) {
    const licKey = localStorage.getItem('dmi_pos_license_key') || '';
    return (
      <SubscriptionLockScreen 
        licenseKey={licKey} 
        expiredDate={licenseExpiryDate}
        onUnlocked={() => {
          setIsSubscriptionExpired(false);
          window.location.reload();
        }}
      />
    );
  }

  const getPlanLimits = () => {
    const norm = (licensePlan || '').toUpperCase();
    if (norm.includes('GOLD') || norm.includes('HOTEL') || norm.includes('ENTERPRISE') || norm.includes('HOSPITALITY')) {
      return {
        hasHrm: true,
        hasGuestDesk: true,
        label: 'SaaS Gold Enterprise / Hotel Suite'
      };
    }
    if (norm.includes('SILVER') || norm.includes('GROWTH')) {
      return {
        hasHrm: true,
        hasGuestDesk: true,
        label: 'Silver Growth'
      };
    }
    return {
      hasHrm: true,
      hasGuestDesk: true,
      label: licensePlan ? licensePlan : 'Bronze Standard / Local-First'
    };
  };

  const renderContent = () => {
    if (!user || !activeBusinessId || !activeShopId) return null;

    const limits = getPlanLimits();

    if (activeTab === 'hrm' && !limits.hasHrm) {
      return (
        <div className="p-12 text-center bg-card rounded-3xl border border-border shadow-md max-w-xl mx-auto my-12 space-y-6">
          <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 mx-auto">
            <UserCheck className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-ink">HRM Employee Module Locked</h3>
          <p className="text-sm text-slate-500 leading-relaxed animate-pulse">
            The Human Resource employee management module, staff salaries, attendance logs, and payroll features require an active <b>SaaS Gold Enterprise</b> subscription level alignment.
          </p>
          <div className="inline-block px-3 py-1 text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-500/10 rounded-full border border-rose-200 dark:border-rose-500/20">
            Registered Tier: {limits.label}
          </div>
          <div className="pt-2">
            <button 
              onClick={() => setActiveTab('pos')}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs hover:brightness-110 transition-all uppercase tracking-wider"
            >
              Return to POS Cashpoint
            </button>
          </div>
        </div>
      );
    }

    if (activeTab === 'guest-requests' && !limits.hasGuestDesk) {
      return (
        <div className="p-12 text-center bg-card rounded-3xl border border-border shadow-md max-w-xl mx-auto my-12 space-y-6">
          <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 mx-auto">
            <HeartHandshake className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-ink">Hotel Guest Desk Locked</h3>
          <p className="text-sm text-slate-500 leading-relaxed animate-pulse">
            The Digital Wall Menu QR order requests integration, checkout billing, and motel guest desk rooms service require a <b>Hotel & Lodge Suite / Gold</b> license tier.
          </p>
          <div className="inline-block px-3 py-1 text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-500/10 rounded-full border border-rose-200 dark:border-rose-500/20">
            Registered Tier: {limits.label}
          </div>
          <div className="pt-2">
            <button 
              onClick={() => setActiveTab('pos')}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs hover:brightness-110 transition-all uppercase tracking-wider"
            >
              Return to POS Cashpoint
            </button>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'pos':
        return <POS user={user} businessId={activeBusinessId} shopId={activeShopId} />;
      case 'dashboard':
        return user.role === 'admin' ? <Dashboard user={user} businessId={activeBusinessId} shopId={activeShopId} /> : <POS user={user} businessId={activeBusinessId} shopId={activeShopId} />;
      case 'inventory':
        return user.role === 'hr' ? <HRM businessId={activeBusinessId} shopId={activeShopId} user={user} /> : <Inventory user={user} businessId={activeBusinessId} shopId={activeShopId} />;
      case 'invoices':
        return <InvoicesTab businessId={activeBusinessId} shopId={activeShopId} businessProfile={activeBusiness!} shopName={activeShop?.name || ''} />;
      case 'guest-requests':
        return <GuestDeskPanel businessId={activeBusinessId} shopId={activeShopId} user={user} />;
      case 'customers':
        return user.role === 'hr' ? <HRM businessId={activeBusinessId} shopId={activeShopId} user={user} /> : <Customers user={user} businessId={activeBusinessId} onViewLedger={(id) => handleViewLedger(id, 'CUSTOMER')} />;
      case 'settings':
        if (user.username.trim().toUpperCase() === 'HRM' || user.username.trim().toUpperCase() === 'FINANCE') {
          return (
            <div className="p-12 text-center bg-card rounded-3xl border border-border shadow-md max-w-xl mx-auto my-12 space-y-4">
              <Shield className="w-12 h-12 text-rose-500 mx-auto" />
              <h3 className="text-xl font-black text-ink">Settings Access Restricted</h3>
              <p className="text-sm text-slate-500">
                The System Settings tab is reserved exclusively for the primary System Admin. Users logged in under <b>{user.username.toUpperCase()}</b> have full access to all operational, financial, and management modules except system configuration.
              </p>
              <button 
                onClick={() => setActiveTab('pos')}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider"
              >
                Return to Sales POS
              </button>
            </div>
          );
        }
        return <Settings user={user} businessId={activeBusinessId} shopId={activeShopId} onBackToBusiness={handleExitBusiness} zoomLevel={zoomLevel} setZoomLevel={setZoomLevel} />;
      case 'reports':
        return (user.role === 'admin' || user.role === 'hr') ? <Reports businessProfile={activeBusiness!} shop={activeShop} /> : <POS user={user} businessId={activeBusinessId} shopId={activeShopId} />;
      case 'expenses':
        return user.role === 'hr' ? <HRM businessId={activeBusinessId} shopId={activeShopId} user={user} /> : <Expenses businessId={activeBusinessId} shopId={activeShopId} user={user} />;
      case 'suppliers':
        return user.role === 'hr' ? <HRM businessId={activeBusinessId} shopId={activeShopId} user={user} /> : <Suppliers businessId={activeBusinessId} user={user} onViewLedger={(id) => handleViewLedger(id, 'SUPPLIER')} />;
      case 'hrm':
        return <HRM businessId={activeBusinessId} shopId={activeShopId} user={user} />;
      case 'ledger':
        return user.role === 'admin' ? <Ledger businessId={activeBusinessId} user={user} initialSelection={ledgerSelection} onClearSelection={() => setLedgerSelection(null)} /> : <POS user={user} businessId={activeBusinessId} shopId={activeShopId} />;
      case 'alerts':
        return user.role === 'admin' ? <Dashboard user={user} businessId={activeBusinessId} shopId={activeShopId} /> : <POS user={user} businessId={activeBusinessId} shopId={activeShopId} />;
      default:
        return <POS user={user} businessId={activeBusinessId} shopId={activeShopId} />;
    }
  };

  const mainView = () => {
    // Standalone print check
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('printSaleId')) {
      return <StandalonePrintPage saleId={urlParams.get('printSaleId')!} />;
    }

    // Direct QR scanning guest bypass mode
    if (urlParams.get('mode') === 'guest') {
      const guestBizId = urlParams.get('businessId');
      const guestShId = urlParams.get('shopId');
      if (guestBizId && guestShId) {
        return <GuestPortal businessId={guestBizId} shopId={guestShId} />;
      }
    }

    if (!isActivated) {
      return <ActivationScreen onActivated={() => setIsActivated(true)} onMasterLogin={() => setShowMasterLogin(true)} />;
    }

    if (!user) {
      return <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <Auth onUserLoaded={setUser} />
      </div>;
    }

    if (!activeBusinessId || !activeBusiness) {
      return <BusinessSelector user={user} onSelect={handleBusinessSelect} onLogout={handleLogout} />;
    }

    if (!activeShopId) {
      return <ShopSelector business={activeBusiness} onSelect={handleShopSelect} onBack={handleExitBusiness} onLogout={handleLogout} />;
    }

    return (
      <Layout 
        user={user} 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          if (tab === 'master-admin') {
            setShowMasterLogin(true);
          } else {
            setActiveTab(tab);
          }
        }}
        unreadAlerts={unreadAlerts}
        businessName={activeBusiness.name}
        businessLogo={activeBusiness.logo}
        shopName={activeShop?.name || ''}
        authComponent={<Auth onUserLoaded={setUser} />}
        onExitBusiness={handleExitBusiness}
        businessType={activeBusiness?.type}
      >
        {renderContent()}
      </Layout>
    );
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-bg transition-colors duration-300">
        {mainView()}
        <InstallPrompt />
        {showMasterLogin && (
          <MasterLogin 
            onLogin={(success) => {
              if (success) setIsMasterMode(true);
              setShowMasterLogin(false);
            }} 
            onCancel={() => setShowMasterLogin(false)} 
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

