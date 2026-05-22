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
import { createPortal } from 'react-dom';

import { ErrorBoundary } from './components/ErrorBoundary';
import { BusinessSelector } from './components/BusinessSelector';
import { ShopSelector } from './components/ShopSelector';
import { ActivationScreen } from './components/ActivationScreen';
import { InstallPrompt } from './components/InstallPrompt';

import { MasterAdmin } from './components/MasterAdmin';
import { MasterLogin } from './components/MasterLogin';
import { PenaltyScreen } from './components/PenaltyScreen';
import { masterService, supabase } from './services/masterService';

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

  useEffect(() => {
    localDb.vacuum();
    const isActivatedLocally = localDb.isActivated();
    
    // License Heartbeat & Anti-Piracy Check
    const checkLicense = async () => {
      if (!isActivatedLocally) return;

      const licenseKey = localStorage.getItem('dmi_pos_license_key');
      if (licenseKey) {
        const fingerPrint = await getMachineFingerprint();
        const domain = window.location.hostname;
        
        const result = await masterService.verifyLicense(licenseKey, fingerPrint, domain);
        if (!result.success && (result.isLocked || result.securityBreach)) {
          setIsSystemLocked(true);
          // If explicitly revoked by server, we should also deactivate local trigger
          if (result.message?.includes('Revoked') || result.message?.includes('Deleted')) {
            await localDb.deactivate();
            setIsActivated(false);
          }
        }
      }
    };

    // Only skip master mode check if strictly requested or in specific environments
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('master_access') === import.meta.env.VITE_MASTER_ADMIN_SECRET) {
      setIsMasterMode(true);
    }

    checkLicense();
    
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
              if (newStatus === 'LOCKED') {
                setIsSystemLocked(true);
              } else if (newStatus === 'ACTIVE') {
                setIsSystemLocked(false);
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
      const updateAlerts = () => {
        const alerts = localDb.getAlerts(activeBusinessId, activeShopId);
        
        // Check for overdue debts (more than 24 hours)
        const debts = localDb.getAllDebts(activeBusinessId, activeShopId);
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        debts.forEach(debt => {
          if (debt.status !== 'PAID' && debt.status !== 'OVERDUE') {
            const dueDate = new Date(debt.dueDate);
            if (dueDate < twentyFourHoursAgo) {
              // Mark as overdue in DB
              localDb.updateDebt(debt.id, { status: 'OVERDUE' });
              
              // Create alert if not already exists
              const existingAlert = alerts.find(a => a.type === 'DEBT_OVERDUE' && a.details?.debtId === debt.id);
              if (!existingAlert) {
                localDb.addAlert({
                  businessId: activeBusinessId,
                  shopId: activeShopId,
                  type: 'DEBT_OVERDUE',
                  message: `Debt for sale ${debt.saleId.slice(0, 8)} is overdue by more than 24 hours.`,
                  timestamp: now.toISOString(),
                  status: 'UNREAD',
                  details: { debtId: debt.id, customerId: debt.customerId }
                });
              }
            }
          }
        });

        setUnreadAlerts(localDb.getAlerts(activeBusinessId, activeShopId).filter(a => a.status === 'UNREAD').length);
      };
      
      updateAlerts();
      const interval = setInterval(updateAlerts, 30000); // Poll every 30 seconds
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

  const handleLogout = () => {
    localAuth.logout();
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

  const renderContent = () => {
    if (!user || !activeBusinessId || !activeShopId) return null;

    switch (activeTab) {
      case 'pos':
        return <POS user={user} businessId={activeBusinessId} shopId={activeShopId} />;
      case 'dashboard':
        return user.role === 'admin' ? <Dashboard user={user} businessId={activeBusinessId} shopId={activeShopId} /> : <POS user={user} businessId={activeBusinessId} shopId={activeShopId} />;
      case 'inventory':
        return user.role === 'hr' ? <HRM businessId={activeBusinessId} shopId={activeShopId} user={user} /> : <Inventory user={user} businessId={activeBusinessId} shopId={activeShopId} />;
      case 'customers':
        return user.role === 'hr' ? <HRM businessId={activeBusinessId} shopId={activeShopId} user={user} /> : <Customers user={user} businessId={activeBusinessId} onViewLedger={(id) => handleViewLedger(id, 'CUSTOMER')} />;
      case 'settings':
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
    if (!isActivated) {
      return <ActivationScreen onActivated={() => setIsActivated(true)} onMasterLogin={() => setShowMasterLogin(true)} />;
    }

    if (!user) {
      return <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <Auth onUserLoaded={setUser} />
      </div>;
    }

    if (!activeBusinessId || !activeBusiness) {
      return <BusinessSelector onSelect={handleBusinessSelect} onLogout={handleLogout} />;
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

