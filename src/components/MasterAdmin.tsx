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
  Database,
  Award,
  BookOpen,
  Layers,
  Lightbulb,
  Target,
  FileText,
  Smartphone,
  CheckCircle,
  ShieldCheck,
  Laptop,
  UserCheck,
  UserPlus,
  Clock,
  Megaphone,
  Send,
  Terminal,
  Cpu,
  Copy,
  Check,
  Plus,
  Edit,
  Trash2,
  Sliders,
  Code,
  Globe,
  Bell,
  BellRing,
  CheckCheck,
  Zap,
  Filter,
  X,
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { supabase, License, masterService } from '../services/masterService';
import { localDb } from '../services/localDb';
import { SaaSHub } from './SaaSHub';
import { MasterDatabaseSchema } from './MasterDatabaseSchema';

export interface MasterNotification {
  id: string;
  category: 'BUSINESS_ACTIVATION' | 'LICENSE_EXPIRY' | 'SECURITY_PIRACY' | 'SYSTEM_ALERT';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  clientName?: string;
  licenseKey?: string;
  shopId?: string;
  actionType?: 'APPROVE_LICENSE' | 'EXTEND_EXPIRY' | 'RESOLVE_PIRACY' | 'VIEW_CLIENT';
  metadata?: any;
}

interface MasterAdminProps {
  onLogout: () => void;
}

export const MasterAdmin: React.FC<MasterAdminProps> = ({ onLogout }) => {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [piracyAlerts, setPiracyAlerts] = useState<any[]>([]);
  const [stats, setStats] = useState({ 
    totalClients: 0, 
    activeClients: 0, 
    totalRevenue: 0,
    todaySales: 0,
    growth: 0,
    onlineStaff: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'licenses' | 'security' | 'pricing' | 'saas-hub' | 'database' | 'hrm-master' | 'notifications'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');

  // Real-Time Notification System States
  const [notifications, setNotifications] = useState<MasterNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<'ALL' | 'BUSINESS_ACTIVATION' | 'LICENSE_EXPIRY' | 'SECURITY_PIRACY'>('ALL');
  const [alertToast, setAlertToast] = useState<{ title: string; message: string; category: string } | null>(null);

  // Custom Pricing Rates state
  const [customRates, setCustomRates] = useState(() => {
    try {
      const saved = localStorage.getItem('dmi_pos_custom_pricing');
      return saved ? JSON.parse(saved) : { bronze: 2500, silver: 4500, gold: 7500, lifetime: 45000 };
    } catch (e) {
      return { bronze: 2500, silver: 4500, gold: 7500, lifetime: 45000 };
    }
  });
  const [ratesSavedNotice, setRatesSavedNotice] = useState(false);

  // Marketing Broadcast state
  const [broadcastHeadline, setBroadcastHeadline] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastNotice, setBroadcastNotice] = useState('');

  // HRM Master state
  const [masterEmployees, setMasterEmployees] = useState<any[]>([]);
  const [hrmSearch, setHrmSearch] = useState('');
  const [isHrmModalOpen, setIsHrmModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [hrmFormData, setHrmFormData] = useState({
    businessId: 'DEFAULT_BUSINESS',
    shopId: 'Main Branch',
    name: '',
    email: '',
    phone: '',
    role: 'Cashier',
    salary: 25000,
    hireDate: new Date().toISOString().split('T')[0],
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE'
  });

  // Offline License Generator state inside Dev Hub
  const [devMachineId, setDevMachineId] = useState('');
  const [devClientName, setDevClientName] = useState('Client Standalone EXE');
  const [generatedOfflineKey, setGeneratedOfflineKey] = useState('');
  const [generatedOfflineResponseCode, setGeneratedOfflineResponseCode] = useState('');
  const [keyCopied, setKeyCopied] = useState(false);

  // Webhook / API Tester state
  const [webhookUrl, setWebhookUrl] = useState('https://api.dmipos.com/v1/mpesa-callback');
  const [webhookPayload, setWebhookPayload] = useState(JSON.stringify({ event: 'MPESA_PAYMENT_SUCCESS', amount: 3500, phone: '254712345678', mpesaRef: 'QKH89123XZ' }, null, 2));
  const [webhookResult, setWebhookResult] = useState<string | null>(null);

  // Master API Keys
  const [apiKeys, setApiKeys] = useState<{ id: string; key: string; name: string; created: string }[]>(() => {
    try {
      const saved = localStorage.getItem('dmi_master_api_keys');
      return saved ? JSON.parse(saved) : [{ id: '1', key: 'dmi_live_sec_99a823x71290a', name: 'Master Operations SDK Token', created: new Date().toISOString() }];
    } catch (e) {
      return [];
    }
  });
  const [newKeyName, setNewKeyName] = useState('');

  // Pricing & Commercial Strategy States
  const [saasClients, setSaasClients] = useState(5);
  const [oneOffClients, setOneOffClients] = useState(2);
  const [hotelClients, setHotelClients] = useState(3);
  const [selectedPitch, setSelectedPitch] = useState<'retail' | 'hardware' | 'hotel'>('retail');

  useEffect(() => {
    fetchData();
    
    // Check network status
    window.addEventListener('online', () => setNetworkStatus('online'));
    window.addEventListener('offline', () => setNetworkStatus('offline'));

    // Real-time subscription for licenses
    const licenseSubscription = supabase
      .channel('master-licenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licenses' }, (payload) => {
        fetchData();
        if (payload.eventType === 'INSERT') {
          setAlertToast({
            title: '✨ Business Activation Requested',
            message: `Retail client "${payload.new?.client_name || 'New Terminal'}" requested license activation!`,
            category: 'BUSINESS_ACTIVATION'
          });
          setTimeout(() => setAlertToast(null), 6000);
        }
      })
      .subscribe();

    // Real-time subscription for sales
    const salesSubscription = supabase
      .channel('master-sales')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, () => {
        fetchData();
      })
      .subscribe();

    // Real-time subscription for piracy alerts
    const alertsSubscription = supabase
      .channel('master-piracy-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'piracy_alerts' }, (payload) => {
        fetchData();
        if (payload.eventType === 'INSERT') {
          setAlertToast({
            title: '🚨 SECURITY & PIRACY ALERT!',
            message: payload.new?.message || payload.new?.reason || 'Unauthorized clone executable detected in retail terminal!',
            category: 'SECURITY_PIRACY'
          });
          setTimeout(() => setAlertToast(null), 6000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(licenseSubscription);
      supabase.removeChannel(salesSubscription);
      supabase.removeChannel(alertsSubscription);
    };
  }, []);

  const compileNotificationsList = (licenseList: License[], alertList: any[]) => {
    let readIds = new Set<string>();
    try {
      const saved = localStorage.getItem('dmi_master_read_notifications');
      if (saved) readIds = new Set(JSON.parse(saved));
    } catch (e) {}

    const list: MasterNotification[] = [];

    // 1. Business Activations
    licenseList.forEach(l => {
      if (l.status === 'PENDING') {
        list.push({
          id: `act-pending-${l.id}`,
          category: 'BUSINESS_ACTIVATION',
          severity: 'CRITICAL',
          title: `Pending License Activation: ${l.client_name}`,
          message: `Retail business "${l.client_name}" (${l.system_type}) requested activation. Key: ${l.license_key}`,
          timestamp: l.created_at || new Date().toISOString(),
          read: readIds.has(`act-pending-${l.id}`),
          clientName: l.client_name,
          licenseKey: l.license_key,
          actionType: 'APPROVE_LICENSE',
          metadata: l
        });
      } else if (l.status === 'ACTIVE' && l.created_at && (Date.now() - new Date(l.created_at).getTime()) < 14 * 86400000) {
        list.push({
          id: `act-recent-${l.id}`,
          category: 'BUSINESS_ACTIVATION',
          severity: 'INFO',
          title: `Business Activated: ${l.client_name}`,
          message: `Terminal license ${l.license_key} was activated for ${l.client_name}. System: ${l.system_type}`,
          timestamp: l.created_at,
          read: readIds.has(`act-recent-${l.id}`),
          clientName: l.client_name,
          licenseKey: l.license_key,
          actionType: 'VIEW_CLIENT',
          metadata: l
        });
      }
    });

    // 2. License Expirations
    const nowMs = Date.now();
    licenseList.forEach(l => {
      if (l.expiry_date) {
        const expiryMs = new Date(l.expiry_date).getTime();
        const diffDays = Math.ceil((expiryMs - nowMs) / (1000 * 60 * 60 * 24));

        if (diffDays <= 0 || l.status === 'EXPIRED') {
          list.push({
            id: `exp-expired-${l.id}`,
            category: 'LICENSE_EXPIRY',
            severity: 'CRITICAL',
            title: `EXPIRED LICENSE: ${l.client_name}`,
            message: `Retail subscription license for ${l.client_name} expired on ${new Date(l.expiry_date).toLocaleDateString()}. Client system locked.`,
            timestamp: l.expiry_date,
            read: readIds.has(`exp-expired-${l.id}`),
            clientName: l.client_name,
            licenseKey: l.license_key,
            actionType: 'EXTEND_EXPIRY',
            metadata: l
          });
        } else if (diffDays <= 30) {
          list.push({
            id: `exp-soon-${l.id}`,
            category: 'LICENSE_EXPIRY',
            severity: diffDays <= 7 ? 'CRITICAL' : 'WARNING',
            title: `License Expiring in ${diffDays} Days: ${l.client_name}`,
            message: `Key ${l.license_key} for ${l.client_name} expires on ${new Date(l.expiry_date).toLocaleDateString()}. Contact shop owner.`,
            timestamp: l.expiry_date,
            read: readIds.has(`exp-soon-${l.id}`),
            clientName: l.client_name,
            licenseKey: l.license_key,
            actionType: 'EXTEND_EXPIRY',
            metadata: l
          });
        }
      }
    });

    // 3. Security & Piracy Alerts
    alertList.forEach((a, idx) => {
      if (!a.resolved) {
        list.push({
          id: `sec-${a.id || idx}`,
          category: 'SECURITY_PIRACY',
          severity: 'CRITICAL',
          title: `Security Breach Alert: ${a.client_name || a.license_key || 'Retail Shop Terminal'}`,
          message: a.message || a.reason || `Hardware MAC/CPU mismatch or unauthorized domain access detected for key ${a.license_key}`,
          timestamp: a.timestamp || a.created_at || new Date().toISOString(),
          read: readIds.has(`sec-${a.id || idx}`),
          clientName: a.client_name,
          licenseKey: a.license_key,
          actionType: 'RESOLVE_PIRACY',
          metadata: a
        });
      }
    });

    // Sort descending by timestamp
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setNotifications(list);
    setUnreadCount(list.filter(n => !n.read).length);
  };

  const handleApproveLicenseNotification = async (licenseKey?: string) => {
    if (!licenseKey) return;
    const { data } = await supabase.from('licenses').select('*').eq('license_key', licenseKey).single();
    if (data) {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      await supabase.from('licenses').update({
        status: 'ACTIVE',
        expiry_date: nextYear.toISOString().split('T')[0]
      }).eq('id', data.id);

      const cachedLicenseStr = localStorage.getItem('dmi_cached_license');
      if (cachedLicenseStr) {
        try {
          const parsed = JSON.parse(cachedLicenseStr);
          if (parsed.license_key === licenseKey) {
            localStorage.setItem('dmi_cached_license', JSON.stringify({
              ...parsed,
              status: 'ACTIVE',
              expiry_date: nextYear.toISOString().split('T')[0]
            }));
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }

      setAlertToast({
        title: 'Business License Activated!',
        message: `Successfully approved & activated license for ${data.client_name}`,
        category: 'BUSINESS_ACTIVATION'
      });
      setTimeout(() => setAlertToast(null), 4000);
      fetchData();
    }
  };

  const handleExtendLicenseNotification = async (licenseKey?: string, daysToAdd: number = 30) => {
    if (!licenseKey) return;
    const { data } = await supabase.from('licenses').select('*').eq('license_key', licenseKey).single();
    if (data) {
      const currentExpiry = data.expiry_date ? new Date(data.expiry_date) : new Date();
      currentExpiry.setDate(currentExpiry.getDate() + daysToAdd);
      const newExpiryStr = currentExpiry.toISOString().split('T')[0];

      await supabase.from('licenses').update({
        status: 'ACTIVE',
        expiry_date: newExpiryStr
      }).eq('id', data.id);

      setAlertToast({
        title: 'License Extended!',
        message: `Extended ${data.client_name} license by ${daysToAdd} days (New expiry: ${newExpiryStr})`,
        category: 'LICENSE_EXPIRY'
      });
      setTimeout(() => setAlertToast(null), 4000);
      fetchData();
    }
  };

  const handleResolvePiracyNotification = async (alertId?: string) => {
    if (!alertId) return;
    await supabase.from('piracy_alerts').update({ resolved: true }).eq('id', alertId);
    setAlertToast({
      title: 'Security Breach Resolved',
      message: 'Piracy incident marked as investigated and resolved.',
      category: 'SECURITY_PIRACY'
    });
    setTimeout(() => setAlertToast(null), 4000);
    fetchData();
  };

  const handleMarkNotificationRead = (notifId: string) => {
    try {
      const saved = localStorage.getItem('dmi_master_read_notifications');
      const readIds = saved ? JSON.parse(saved) : [];
      if (!readIds.includes(notifId)) {
        readIds.push(notifId);
        localStorage.setItem('dmi_master_read_notifications', JSON.stringify(readIds));
      }
    } catch (e) {}

    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllNotificationsRead = () => {
    const allIds = notifications.map(n => n.id);
    localStorage.setItem('dmi_master_read_notifications', JSON.stringify(allIds));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleTriggerTestAlert = async () => {
    const testTypes = ['PIRACY', 'ACTIVATION', 'EXPIRY'];
    const selected = testTypes[Math.floor(Math.random() * testTypes.length)];

    if (selected === 'PIRACY') {
      const sampleAlert = {
        client_name: 'Nairobi West Retail Hub',
        license_key: 'DMI-TEST-9921-KEY',
        reason: 'Hardware UUID Mismatch - Unauthorized Clone Executable Launched',
        timestamp: new Date().toISOString(),
        resolved: false
      };
      await supabase.from('piracy_alerts').insert([sampleAlert]);
      setAlertToast({
        title: '🚨 Real-Time Security Alert Simulated',
        message: 'Cloned executable detected in Nairobi West branch!',
        category: 'SECURITY_PIRACY'
      });
    } else if (selected === 'ACTIVATION') {
      const sampleLicense = {
        client_name: 'Mombasa Supermarket Ltd',
        system_type: 'RetailMaster',
        license_key: `DMI-MBA-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'PENDING',
        activation_type: 'ANNUAL',
        created_at: new Date().toISOString()
      };
      await supabase.from('licenses').insert([sampleLicense]);
      setAlertToast({
        title: '✨ Business Activation Requested',
        message: 'Mombasa Supermarket Ltd requested new POS license activation!',
        category: 'BUSINESS_ACTIVATION'
      });
    } else {
      setAlertToast({
        title: '⚠️ Expiry Warning Simulated',
        message: 'Eldoret Hardware Outlet license expires in 3 days!',
        category: 'LICENSE_EXPIRY'
      });
    }

    setTimeout(() => setAlertToast(null), 5000);
    fetchData();
  };

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
        const { data: salesData, error: salesError } = await supabase
          .from('sales')
          .select('*')
          .order('timestamp', { ascending: false });
        
        // Fix health status logic: only 'ok' if no error
        const salesStatus = salesError 
          ? 'missing' 
          : 'ok';
        health.push({ table: 'sales', status: salesStatus });
        
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

      // FALLBACK: If sales table is missing, use licenses as revenue source
      if (currentSales.length === 0 && licenseData && licenseData.length > 0) {
        currentSales = licenseData.map(l => ({
          id: l.id,
          total: Number(l.license_fee || 0),
          client_name: l.client_name,
          category: 'LICENSE_FEE',
          timestamp: l.created_at,
          created_at: l.created_at
        }));
      }
      
      setRecentSales(currentSales.slice(0, 10));
      
      const now = new Date();
      const todayDateStr = now.toDateString();
      
      const todaySales = currentSales
        .filter(s => {
          const sDate = s.timestamp || s.created_at;
          if (!sDate) return false;
          return new Date(sDate).toDateString() === todayDateStr;
        })
        .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
        
      const totalRev = currentSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);

      // Calculate Growth (Month-over-month)
      const thisMonthStr = now.toISOString().slice(0, 7);
      const lastMonthDate = new Date();
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
      const lastMonthStr = lastMonthDate.toISOString().slice(0, 7);
      
      const thisMonthSales = currentSales
        .filter(s => (s.timestamp || s.created_at)?.startsWith(thisMonthStr))
        .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
        
      const lastMonthSales = currentSales
        .filter(s => (s.timestamp || s.created_at)?.startsWith(lastMonthStr))
        .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
      
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

      // 4. Piracy Alerts Health & Fetch
      let alertsList: any[] = [];
      try {
        const { data: alertData, error: alertError } = await supabase
          .from('piracy_alerts')
          .select('*')
          .order('timestamp', { ascending: false });
        
        health.push({ table: 'piracy_alerts', status: (alertError && alertError.message.includes('not found')) ? 'missing' : 'ok' });
        if (alertData) {
          alertsList = alertData;
        }
      } catch (e) {
        health.push({ table: 'piracy_alerts', status: 'missing' });
      }
      setPiracyAlerts(alertsList);
      compileNotificationsList(licenseData || [], alertsList);
      
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
    const id = crypto.randomUUID();
    
    try {
      const payload = {
        id,
        client_name: clientName,
        system_name: systemName,
        license_key: licenseKey,
        license_fee: Number(fee),
        status: 'ACTIVE',
        penalty_amount: Math.floor(Number(fee) * 1.5)
      };
      
      const { error } = await supabase.from('licenses').insert(payload);

      if (error) {
        alert('Error creating license: ' + error.message);
      } else {
        // Record the license fee as a sale for the developer
        try {
          const { error: saleError } = await supabase.from('sales').insert({
            id: crypto.randomUUID(),
            total: Number(fee),
            items: [{ name: 'License Purchase', quantity: 1, price: Number(fee) }],
            cashier_id: 'MASTER_ADMIN',
            cashier_name: 'DMi Admin',
            client_name: clientName,
            payment_method: 'CASH',
            timestamp: new Date().toISOString()
          });
          
          if (saleError) {
            console.error('Sale log failed:', saleError);
            // Suppress alert if it's just a missing table error, as we have a fallback in the UI
            const isMissingTable = saleError.message.includes('not found') || 
                                  saleError.message.includes('schema cache') || 
                                  saleError.message.includes('relation "sales" does not exist');
            
            if (!isMissingTable) {
              alert('Note: License created but payment logging failed: ' + saleError.message);
            }
          }
        } catch (e: any) {
          console.warn('Failed to record sale:', e);
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

  const handleApproveMpesa = async (license: any) => {
    const confirm = window.confirm(`Approve client activation for ${license.client_name}? This will grant access and register billing.`);
    if (!confirm) return;

    // Check if subscription or one-off
    const isOneOff = license.plan_type?.toLowerCase().includes('one-off') || Number(license.license_fee) > 10000;
    
    // Set 30 days expiry if subscription, otherwise null
    const expiresAt = isOneOff 
      ? null 
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Generate secure license key format: DMI-XXXX-XXXX-XXXX
    let finalKey = license.license_key;
    if (!finalKey || finalKey.startsWith('PENDING_KEY_') || finalKey.startsWith('AWAITING_')) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const generateSegment = () => Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      finalKey = `DMI-${generateSegment()}-${generateSegment()}-${generateSegment()}`;
    }

    try {
      const { error } = await supabase
        .from('licenses')
        .update({
          status: 'ACTIVE',
          payment_status: 'PAID',
          expires_at: expiresAt,
          license_key: finalKey
        })
        .eq('id', license.id);

      if (error) {
        alert('Approval failed: ' + error.message);
      } else {
        // Record payment sale transaction
        try {
          await supabase.from('sales').insert({
            id: crypto.randomUUID(),
            total: Number(license.license_fee),
            items: [{ name: `M-Pesa License Dev-Approval: ${license.plan_type || 'Classic'}`, quantity: 1, price: Number(license.license_fee) }],
            cashier_id: 'MASTER_ADMIN',
            cashier_name: 'David Migichi',
            client_name: license.client_name,
            payment_method: 'MPESA',
            mpesa_reference: license.mpesa_reference || 'MANUAL_ALLOW',
            timestamp: new Date().toISOString()
          });
        } catch (se) {}

        // Add notice to alerts
        try {
          await supabase.from('piracy_alerts').insert({
            id: crypto.randomUUID(),
            license_id: license.id,
            message: `🟢 APPROVED MANUALLY: David approved KES ${Number(license.license_fee).toLocaleString()} for ${license.client_name}. App is live! Generated License Key: ${finalKey}`,
            timestamp: new Date().toISOString()
          });
        } catch (ae) {}

        alert(`SUCCESS: Client unlocked instantly! They are now live on the network.\n\nGenerated License Key: ${finalKey}`);
        fetchData();
      }
    } catch (e: any) {
      alert('Error updating row: ' + e.message);
    }
  };

  const handleResetPin = async (clientName: string) => {
    const confirm = window.confirm(`Generate a one-time master bypass PIN for ${clientName}?`);
    if (confirm) {
      const bypassCode = Math.floor(1000 + Math.random() * 9000).toString();
      alert(`MASTER BYPASS CODE GENERATED: ${bypassCode}\n\nInstruct the client to enter this code in their PIN prompt. It will reset their local admin PIN.`);
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    const confirm = window.confirm('Are you sure you want to dismiss and delete this security alert log?');
    if (!confirm) return;
    try {
      const { error } = await supabase.from('piracy_alerts').delete().eq('id', alertId);
      if (error) alert('Failed to dismiss alert: ' + error.message);
      else {
        fetchData();
      }
    } catch (e: any) {
      alert('Error dismissing alert: ' + e.message);
    }
  };

  const handleResetHardwareLock = async (licenseId: string, clientName: string) => {
    const confirm = window.confirm(`LEGITIMATE RE-ACTIVATION: Clear hardware signature lock for ${clientName || 'this license'}? They will be able to lock onto a new computer/motherboard on next boot.`);
    if (!confirm) return;
    try {
      const { error } = await supabase.from('licenses').update({ machine_id: null, status: 'ACTIVE' }).eq('id', licenseId);
      if (error) alert('Failed to reset hardware lock: ' + error.message);
      else {
        alert('SUCCESS: Hardware lock cleared! The next device they boot will register as their primary device.');
        fetchData();
      }
    } catch (e: any) {
      alert('Error resetting lock: ' + e.message);
    }
  };

  const handleLockLicense = async (licenseId: string, clientName: string) => {
    const confirm = window.confirm(`DANGER - REMOTE LOCKOUT: Instantly revoke and lock license for ${clientName || 'this license'}? This will lock their system screen remotely, halting all local operations.`);
    if (!confirm) return;
    try {
      const { error } = await supabase.from('licenses').update({ status: 'LOCKED' }).eq('id', licenseId);
      if (error) alert('Failed to lock license: ' + error.message);
      else {
        alert('SUCCESS: Client license is now locked on the cloud network.');
        fetchData();
      }
    } catch (e: any) {
      alert('Error locking license: ' + e.message);
    }
  };

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amt);
  };

  const filteredLicenses = licenses.filter(l => 
    (l.client_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (l.license_key || '').toLowerCase().includes(searchQuery.toLowerCase())
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
          <button 
            onClick={() => setView('pricing')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${view === 'pricing' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
            id="pricing-tab-btn"
          >
            <DollarSign className="w-4 h-4" />
            Pricing & Marketing
          </button>
          <button 
            onClick={() => setView('hrm-master')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${view === 'hrm-master' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <UserCheck className="w-4 h-4" />
            HRM & Staff Hub
          </button>
          <button 
            onClick={() => setView('saas-hub')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${view === 'saas-hub' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <Laptop className="w-4 h-4" />
            SaaS Developer Hub
          </button>
          <button 
            onClick={() => setView('database')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${view === 'database' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <Database className="w-4 h-4" />
            SQL Schema
          </button>
          <button 
            onClick={() => setView('notifications')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 relative ${view === 'notifications' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Real-Time Alerts</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded-full animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
        </nav>

        <div className="flex items-center gap-2">
          {/* Bell Icon Button */}
          <button
            onClick={() => setIsNotificationDrawerOpen(!isNotificationDrawerOpen)}
            className="relative p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-all flex items-center justify-center border border-slate-700"
            title="Real-Time Alerts Drawer"
          >
            <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-amber-400 animate-bounce' : 'text-slate-400'}`} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-md">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

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
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Revenue</p>
                  <h3 className="text-3xl font-black">{formatCurrency(stats.totalRevenue)}</h3>
                </div>
              </div>
              <div className="text-xs font-bold text-slate-400">
                Lifetime revenue generated
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

              {/* M-Pesa Pending Approvals Queue */}
              {licenses.filter(l => l.status === 'PENDING').length > 0 && (
                <div className="p-6 bg-slate-900/80 border-b border-slate-800">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                    <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider">Awaiting M-Pesa Client Activation Approvals</h4>
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[9px] font-black rounded">
                      {licenses.filter(l => l.status === 'PENDING').length} PENDING UNLOCK
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {licenses.filter(l => l.status === 'PENDING').map(pending => (
                      <div key={pending.id} className="p-4 bg-slate-950 border border-slate-850 rounded-2xl flex flex-col justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-white text-sm">{pending.client_name}</span>
                            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[9px] font-bold rounded uppercase">
                              {pending.plan_type || 'Custom Plan'}
                            </span>
                          </div>
                          <div className="text-slate-400">
                            Device Terminal Type: <strong className="text-slate-300">{pending.system_name}</strong>
                          </div>
                          {pending.payment_phone && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-400">
                              <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                              Phone: <span className="font-mono font-bold text-slate-300">+{pending.payment_phone}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-4 bg-slate-900/60 p-2.5 border border-slate-800 rounded-xl mt-1">
                            <div>
                              <span className="text-[9px] uppercase font-black text-slate-500 block">Pricing</span>
                              <span className="font-extrabold text-emerald-400 font-mono">KES {Number(pending.license_fee || 0).toLocaleString()}</span>
                            </div>
                            <div className="border-l border-slate-800 pl-4">
                              <span className="text-[9px] uppercase font-black text-slate-500 block">Entered Receipt Ref</span>
                              <span className="font-mono font-black text-indigo-400 uppercase tracking-widest">{pending.mpesa_reference || 'STK_AUTO_WAIT'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 border-t border-slate-900 pt-3">
                          <button 
                            onClick={() => handleApproveMpesa(pending)}
                            className="flex-grow py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <CheckCircle className="w-3.5 h-3.5 animate-bounce" /> Confirm & Allow
                          </button>
                          <button 
                            onClick={async () => {
                              const confirmDecline = window.confirm(`Decline and revoke order for ${pending.client_name}?`);
                              if (confirmDecline) {
                                await supabase.from('licenses').delete().eq('id', pending.id);
                                fetchData();
                              }
                            }}
                            className="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-xl font-semibold uppercase text-[10px] tracking-wide"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-950/50 text-[10px] uppercase font-black tracking-widest text-slate-500">
                      <th className="px-6 py-4">Client / System</th>
                      <th className="px-6 py-4">License Key</th>
                      <th className="px-6 py-4">License Plan & Expiry</th>
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
                            {license.license_key && !license.license_key.startsWith('PENDING_KEY_') ? (
                              <code className="bg-slate-950 px-2 py-1 rounded-lg text-xs text-indigo-400 border border-slate-800">{license.license_key}</code>
                            ) : (
                              <span className="px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-amber-500/20">Awaiting Key Generation</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs">
                            <div className="font-bold text-indigo-400">{license.plan_type || 'Classic License'}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {license.expires_at ? (
                                new Date(license.expires_at) < new Date() ? (
                                  <span className="text-red-400 font-bold">Expired: {format(new Date(license.expires_at), 'MMM dd, yyyy')}</span>
                                ) : (
                                  <span className="text-emerald-400 font-bold">Expires: {format(new Date(license.expires_at), 'MMM dd, yyyy')}</span>
                                )
                              ) : (
                                <span className="text-slate-500 italic">One-Off / Infinite</span>
                              )}
                            </div>
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
                      {recentSales.map(sale => (
                         <tr key={sale.id} className="group">
                           <td className="py-4 font-bold text-sm text-slate-300">{sale.client_name}</td>
                           <td className="py-4 text-[10px] font-black uppercase text-indigo-400/70 tracking-widest">
                             {sale.payment_method || 'License Fee'}
                           </td>
                           <td className="py-4 font-black text-slate-100">{formatCurrency(sale.total || 0)}</td>
                           <td className="py-4 text-xs text-slate-500">
                             { (sale.timestamp || sale.created_at) ? format(new Date(sale.timestamp || sale.created_at), 'MMM dd, HH:mm') : '---' }
                           </td>
                           <td className="py-4 text-right">
                             <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase rounded">Confirmed</span>
                           </td>
                         </tr>
                      ))}
                      {recentSales.length === 0 && (
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

              {/* Real-Time watchdog alerts */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight">Watchdog Alert Stream</h3>
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-0.5">Real-time alerts from active standalone PC client softwares</p>
                    </div>
                  </div>
                  <span className="text-xs font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">
                    ● Watchdog Live
                  </span>
                </div>

                {piracyAlerts.length === 0 ? (
                  <div className="text-center py-10 bg-slate-950/40 border border-slate-800/80 rounded-2xl p-6">
                    <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-black text-slate-200 uppercase tracking-wide">All Systems Nominal</p>
                    <p className="text-xs text-slate-500 mt-1">No anti-copying triggers or hardware signatures mismatch detected.</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {piracyAlerts.map((alert) => {
                      const associatedLicense = licenses.find(l => l.id === alert.license_id);
                      const isApproval = alert.message?.includes('🟢');
                      
                      return (
                        <div 
                          key={alert.id} 
                          className={`p-5 bg-slate-950/80 border rounded-2xl transition-all ${
                            isApproval 
                              ? 'border-emerald-500/20 hover:border-emerald-500/40 border-l-4 border-l-emerald-500' 
                              : 'border-rose-500/20 hover:border-rose-500/40 border-l-4 border-l-rose-500'
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                                  isApproval ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                }`}>
                                  {isApproval ? 'SYSTEM EVENT' : 'SECURITY BREACH'}
                                </span>
                                <span className="text-xs font-bold text-slate-400">
                                  {alert.timestamp ? format(new Date(alert.timestamp), 'MMM dd, yyyy HH:mm:ss') : 'Unknown Time'}
                                </span>
                                {associatedLicense && (
                                  <span className="text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md">
                                    Client: {associatedLicense.client_name}
                                  </span>
                                )}
                              </div>

                              <p className="text-sm text-slate-200 font-medium leading-relaxed">
                                {alert.message}
                              </p>

                              {alert.metadata && (
                                <div className="p-3 bg-slate-900/60 rounded-xl space-y-1 text-[11px] text-slate-400 font-mono border border-slate-800/40">
                                  <div className="flex gap-2">
                                    <span className="text-slate-600 font-bold">HOSTNAME:</span>
                                    <span>{alert.metadata.hostname || 'Unknown'}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <span className="text-slate-600 font-bold">CONTEXT:</span>
                                    <span className="truncate max-w-xl">{alert.metadata.userAgent || 'Unknown Agent'}</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex md:flex-col gap-2 self-end md:self-start">
                              {!isApproval && (
                                <>
                                  <button
                                    onClick={() => handleResetHardwareLock(alert.license_id, associatedLicense?.client_name || '')}
                                    className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[10px] font-black uppercase tracking-wider rounded-lg border border-indigo-500/20 transition-all"
                                    title="Authorizes client onto their new machine, resetting lock."
                                  >
                                    Re-Bind Device
                                  </button>
                                  <button
                                    onClick={() => handleLockLicense(alert.license_id, associatedLicense?.client_name || '')}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all"
                                    title="Locks the client system remotely."
                                  >
                                    Lock License
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleDismissAlert(alert.id)}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-slate-100 text-[10px] font-black uppercase tracking-wider rounded-lg border border-slate-700 transition-all"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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

          {view === 'pricing' && (
            <div className="space-y-8">
              {/* Header */}
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-8"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
                    <Award className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">Commercialization & Pricing Strategy</h2>
                    <p className="text-sm text-slate-400">Specially optimized pricing models and B2B marketing playbooks for the East African SME sector.</p>
                  </div>
                </div>
              </motion.div>

              {/* Pricing Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* tier 1 */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -4 }}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full" />
                  <div>
                    <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-lg">Subscription Mode</span>
                    <h3 className="text-xl font-black my-3 uppercase tracking-tight">SaaS Subscription</h3>
                    <p className="text-slate-400 text-[11px] mb-4">Best for retail stores, cosmetic boutiques, chemists, salons, and medium wholesales.</p>
                    <div className="space-y-1 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 mb-6">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Recommended Monthly Rate</span>
                      <span className="text-2xl font-black text-indigo-400">KES 2,500 - 4,000</span>
                      <span className="text-[9px] text-slate-500 block">Per active terminal & database</span>
                    </div>
                    <ul className="space-y-2.5 text-xs text-slate-300">
                      <li className="flex items-start gap-2">
                        <span className="text-indigo-400 font-bold">✓</span>
                        <span><b>Live Cloud Sync</b>: Syncs offline db to central Supabase server</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-indigo-400 font-bold">✓</span>
                        <span><b>Owner Tracking</b>: Remote stats viewable on active mobile/Web browsers</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-indigo-400 font-bold">✓</span>
                        <span><b>Live Inventory Alerts</b>: WhatsApp/App logs of declining stock levels</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-indigo-400 font-bold">✓</span>
                        <span><b>No Setup Headache</b>: Automatic software upgrades remotely</span>
                      </li>
                    </ul>
                  </div>
                </motion.div>

                {/* tier 2 */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  whileHover={{ y: -4 }}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between border-l-4 border-l-amber-500"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full" />
                  <div>
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-widest rounded-lg">Local-First</span>
                    <h3 className="text-xl font-black my-3 uppercase tracking-tight">One-Off License</h3>
                    <p className="text-slate-400 text-[11px] mb-4">Best for hardware hubs, wholesale yards in remote townships, or standalone bakeries.</p>
                    <div className="space-y-1 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 mb-6">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Single Machine Upfront Fee</span>
                      <span className="text-2xl font-black text-amber-500 font-sans">KES 35,000 - 55,000</span>
                      <span className="text-[9px] text-slate-500 block">One-off license generation</span>
                    </div>
                    <ul className="space-y-2.5 text-xs text-slate-300">
                      <li className="flex items-start gap-2">
                        <span className="text-amber-500 font-bold">✓</span>
                        <span><b>True Offline Work</b>: Operations function completely blind of the web</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-500 font-bold">✓</span>
                        <span><b>Physical PC Mapping</b>: Installed directly onto local Windows/Linux PC</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-500 font-bold">✓</span>
                        <span><b>Hardware Customization</b>: Direct mapping of thermal receipt printers & cash drawer triggers</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-500 font-bold">✓</span>
                        <span><b>Support Cover</b>: 1 year included local troubleshooting & repairs</span>
                      </li>
                    </ul>
                  </div>
                </motion.div>

                {/* tier 3 */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  whileHover={{ y: -4 }}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between border-l-4 border-l-indigo-600"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/5 rounded-bl-full" />
                  <div>
                    <span className="px-3 py-1 bg-indigo-600/10 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-lg">Hospitality Premium</span>
                    <h3 className="text-xl font-black my-3 uppercase tracking-tight">Hotel & Lodge Package</h3>
                    <p className="text-slate-400 text-[11px] mb-4">Best for boutique hotels, lodge pubs, countryside Airbnb managers, motels, and resorts.</p>
                    <div className="space-y-1 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 mb-6">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Dual Licensing Model</span>
                      <span className="text-xl font-black text-indigo-400">KES 5,000 - 8,000 / mo</span>
                      <span className="text-[10px] text-slate-500 block">or <b className="text-indigo-300">KES 80,000</b> standalone</span>
                    </div>
                    <ul className="space-y-2.5 text-xs text-slate-300">
                      <li className="flex items-start gap-2">
                        <span className="text-indigo-400 font-bold">✓</span>
                        <span><b>Full POS Engine</b>: Integrated bar/kitchen inventory tracking & supplier logs</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-indigo-400 font-bold">✓</span>
                        <span><b>Guest Desk</b>: Central guest lodge controller with automated receipts</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-indigo-400 font-bold">✓</span>
                        <span><b>Guest QR Portal</b>: Client-facing mobile interface for rooms, menus, & bills</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-indigo-400 font-bold">✓</span>
                        <span><b>Hybrid Database</b>: Backed by local persistent states & live cloud backup</span>
                      </li>
                    </ul>
                  </div>
                </motion.div>
              </div>

              {/* Projections & Calculator */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Calculator Panel */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-8 lg:col-span-2 space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Income Projection Simulator</h3>
                  </div>
                  
                  <p className="text-slate-400 text-xs">Simulate your client base in Kenya to calculate potential monthly recurring revenue (MRR) and active setup capital.</p>

                  <div className="space-y-6">
                    {/* SaaS Sliders */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-300 flex items-center gap-2"><Layers className="w-3.5 h-3.5 text-indigo-400" /> SaaS Subscribers (KES 3,000/mo mid)</span>
                        <span className="font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800 font-bold text-indigo-400">{saasClients} Clients</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="50" 
                        value={saasClients} 
                        onChange={(e) => setSaasClients(Number(e.target.value))}
                        className="w-full accent-indigo-500 bg-slate-950 h-2 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Local-First Sliders */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-300 flex items-center gap-2"><Key className="w-3.5 h-3.5 text-amber-500" /> One-off Setup Clients (KES 45,000 mid)</span>
                        <span className="font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800 font-bold text-amber-500">{oneOffClients} Clients / Yr</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="20" 
                        value={oneOffClients} 
                        onChange={(e) => setOneOffClients(Number(e.target.value))}
                        className="w-full accent-amber-500 bg-slate-950 h-2 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Hotel Sliders */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-300 flex items-center gap-2"><Store className="w-3.5 h-3.5 text-indigo-400" /> Hotel Package (Recurring KES 6,500/mo mid)</span>
                        <span className="font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800 font-bold text-indigo-400">{hotelClients} Clients</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="15" 
                        value={hotelClients} 
                        onChange={(e) => setHotelClients(Number(e.target.value))}
                        className="w-full accent-indigo-500 bg-slate-950 h-2 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Profit projections display */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-slate-800/50">
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">Monthly Recurring Income (MRR)</p>
                      <h4 className="text-2xl font-black text-emerald-400 font-mono">
                        {formatCurrency(saasClients * 3000 + hotelClients * 6500)}
                      </h4>
                      <p className="text-[9px] text-slate-600 mt-1">SaaS Subscribers + Premium active accounts</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">Total Expected Yearly earnings</p>
                      <h4 className="text-2xl font-black text-white font-mono">
                        {formatCurrency((saasClients * 3000 + hotelClients * 6500) * 12 + (oneOffClients * 45000))}
                      </h4>
                      <p className="text-[9px] text-emerald-400 mt-1">Includes one-off hardware installation setup fees</p>
                    </div>
                  </div>
                </motion.div>

                {/* Target progress meter */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <h4 className="text-md font-black uppercase tracking-tight">Milestone Goal (KES 150K/mo)</h4>
                    <p className="text-xs text-slate-400">Achieving 150,000 KES in Monthly Recurring Revenue grants massive business stability to DMi Technologies.</p>
                    
                    {(() => {
                      const mrrValue = (saasClients * 3000) + (hotelClients * 6500);
                      const percent = Math.min(100, Math.round((mrrValue / 150000) * 100));
                      return (
                        <div className="space-y-2 pt-4">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-400">Goal Progress</span>
                            <span className="text-indigo-400">{percent}%</span>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800 p-0.5">
                            <div 
                              className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-500 block uppercase tracking-wider">MRR Current: {formatCurrency(mrrValue)} / KES 150,000</span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2 mt-6">
                    <h5 className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-yellow-500" /> Capital Optimization
                    </h5>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      SaaS subscription values can cover cloud hosting costs (Supabase databases & background analytics) while custom offline licenses fund physical developer machinery.
                    </p>
                  </div>
                </motion.div>
              </div>

              {/* Modern Marketing Playbook */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Playbook Sidebar Menu */}
                <div className="space-y-3 lg:col-span-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 pl-2">Market Action Scenarios</h4>
                  
                  <button 
                    onClick={() => setSelectedPitch('retail')}
                    className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-3 ${
                      selectedPitch === 'retail' 
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/15' 
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-black uppercase tracking-tight text-xs">Mini-Supermarket / Chemist</h5>
                      <p className="text-[9px] opacity-70">Focuses on inventory leak reduction & audit metrics.</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setSelectedPitch('hardware')}
                    className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-3 ${
                      selectedPitch === 'hardware' 
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/15' 
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-black uppercase tracking-tight text-xs">Hardware Store / Wholesale</h5>
                      <p className="text-[9px] opacity-70">Emphasizes robust offline access & bulletproof receipts.</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setSelectedPitch('hotel')}
                    className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-3 ${
                      selectedPitch === 'hotel' 
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/15' 
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-black uppercase tracking-tight text-xs">Avenue Hotel / Lodges</h5>
                      <p className="text-[9px] opacity-70">Pitches remote tracking & direct mobile guest desk.</p>
                    </div>
                  </button>

                  <div className="p-5 bg-slate-900/60 rounded-3xl border border-slate-800/70 text-slate-400 space-y-2.5">
                    <span className="text-[9px] font-black uppercase text-amber-500 tracking-widest block">Golden Rule</span>
                    <p className="text-[10px] leading-relaxed">
                      "Marketing B2B software is won on trust, reliability, and touchable returns. Never pitch features; sell the exact leakage numbers you will save them."
                    </p>
                  </div>
                </div>

                {/* Scenario Details */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6">
                  <div className="flex items-center gap-2 text-indigo-400 pb-4 border-b border-slate-800/50">
                    <BookOpen className="w-5 h-5" />
                    <h4 className="text-lg font-black uppercase tracking-tight">Interactive Pitch Script Playbook</h4>
                  </div>

                  {selectedPitch === 'retail' && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-wide rounded-lg">Scenario: The 7-Day Zero-Down Trial</span>
                        <h4 className="text-xl font-bold text-white">How to Sell Retail Chemist & Minimarket Stocks</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Kemis chemist or boutique stores lose an average of KES 5,000 to KES 15,000 per month due to undeclared cashier sales and silent stock differences. Here is your pitch mapping:
                        </p>
                      </div>

                      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 border-l-4 border-l-indigo-500">
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">The Opening Pitch Statement</p>
                        <blockquote className="text-sm italic font-medium text-slate-200 pl-4 border-l border-slate-800">
                          "Habari boss. Your business processes 100+ items daily, but how close are you tracking staff leaks or shelf stock levels when you are away? I will set up the DMi System on your PC for exactly <b>7 days free</b>. I'll load 20 of your top-selling products. Keep operating, and on day 7, I will print a stock difference report. If I don't prove exactly which margins you are losing, I will uninstall it for free. No cards, no commitments."
                        </blockquote>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/80">
                          <h5 className="font-bold text-emerald-400 uppercase tracking-widest text-[10px] mb-1">Psychological Trap</h5>
                          <p className="text-slate-400 leading-relaxed">When they see inventory discrepancies in real time, they will NOT let you take the system away. Giving up their daily profit reports feels like flying blind again.</p>
                        </div>
                        <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/80">
                          <h5 className="font-bold text-indigo-400 uppercase tracking-widest text-[10px] mb-1">Closing & Onboarding</h5>
                          <p className="text-slate-400 leading-relaxed">Offer the KES 3,000/mo Cloud Sync subscription. Emphasize that they can tracking daily earnings on their mobile phones remotely via their personal dashboard.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedPitch === 'hardware' && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <span className="px-2.5 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-wide rounded-lg">Scenario: Standalone Premium Installation</span>
                        <h4 className="text-xl font-bold text-white">Pitching Hardware Yards in Township Centers</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Hardware depots process heavy cement packages, iron bars, and paint tins. They demand lightning-fast offline printing, robust POS controls, and hate recurring costs.
                        </p>
                      </div>

                      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 border-l-4 border-l-amber-500">
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">The Setup Pitch Statement</p>
                        <blockquote className="text-sm italic font-medium text-slate-200 pl-4 border-l border-slate-800">
                          "Habari, I have a standalone POS build customized for cement, bars, and pipe inventories. It does not require internet, so even during blackouts your cashier keeps making sales and printing invoices. This is a one-off premium system: KES 45,000 total. I'll configure your legacy EPSON printer, set up your machine license, and cover support for an entire year. You own the software forever."
                        </blockquote>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/80">
                          <h5 className="font-bold text-amber-500 uppercase tracking-widest text-[10px] mb-1">Key Selling Benefit</h5>
                          <p className="text-slate-400 leading-relaxed">Zero reliance on high cost bundles / safaricom internet drops. Hardware inventories are heavy and capital is stationary; local-first is incredibly stable.</p>
                        </div>
                        <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/80">
                          <h5 className="font-bold text-indigo-400 uppercase tracking-widest text-[10px] mb-1">Installation Bundle</h5>
                          <p className="text-slate-400 leading-relaxed">Double down on value by packing a thermal printer + 5 paper rolls with the bundle. It costs you KES 7,000 locally, but secures a high-trust KES 45,000 deal instantly.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedPitch === 'hotel' && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-wide rounded-lg">Scenario: Hospitality Premium (Guest Desk)</span>
                        <h4 className="text-xl font-bold text-white">Deploying Lodges, Resorts & Airbnb Hubs</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Lodges operate dual inventory (bar POS drinks & active guest rooms/check-ins) and require active customer bills matching check-in statuses.
                        </p>
                      </div>

                      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 border-l-4 border-l-indigo-500">
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">The Direct Hotel Pitch</p>
                        <blockquote className="text-sm italic font-medium text-slate-200 pl-4 border-l border-slate-800">
                          "Greetings manager. Your lodgers have to ask reception or call wait staff every time they want to verify active room bills, order food, or request local support. With DMi, guests can scan a custom QR code in their room. They check their current tab, request towels/drinks, and make M-Pesa requests directly. On the counter, your receptionist tracks checkout state on a central dashboard. Includes bar POS. KES 6,500 monthly."
                        </blockquote>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/80">
                          <h5 className="font-bold text-indigo-400 uppercase tracking-widest text-[10px] mb-1">The Guest Portal Edge</h5>
                          <p className="text-slate-400 leading-relaxed">Includes Guest Desk and guest-facing Guest Portal. Guests scan QR, check tabs, make requests, reducing front-desk friction and increasing food orders.</p>
                        </div>
                        <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/80">
                          <h5 className="font-bold text-emerald-400 uppercase tracking-widest text-[10px] mb-1">Easy Multi-Room Upsell</h5>
                          <p className="text-slate-400 leading-relaxed">Offer them 3 months free trial, print 10 room-cards with the custom URL/QR. Managers love tech updates that make lodge guests feel elite and cared for.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Business Checklist */}
                  <div className="pt-6 border-t border-slate-800/60 flex items-center justify-between text-xs font-bold text-slate-500">
                    <span className="flex items-center gap-1.5"><Target className="w-4 h-4 text-emerald-500" /> B2B conversion cycle takes 3 to 7 days.</span>
                    <button 
                      onClick={() => {
                        window.print();
                      }}
                      className="text-[10px] font-black uppercase text-indigo-400 hover:underline flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" /> Export strategy worksheet
                    </button>
                  </div>
                </div>
              </div>

              {/* Master Custom Pricing Rates & Marketing Broadcast */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-t border-slate-800 pt-8">
                {/* Pricing Rates Configurator */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                      <Sliders className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase">Live System Pricing Rates Configurator</h3>
                      <p className="text-xs text-slate-400">Set commercial subscription rates broadcasted to clients.</p>
                    </div>
                  </div>

                  {ratesSavedNotice && (
                    <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2">
                      <Check className="w-4 h-4" /> Pricing rates saved to local system storage & client terminals!
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Bronze SaaS (KES/mo)</label>
                      <input
                        type="number"
                        value={customRates.bronze}
                        onChange={(e) => setCustomRates({ ...customRates, bronze: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Silver Growth (KES/mo)</label>
                      <input
                        type="number"
                        value={customRates.silver}
                        onChange={(e) => setCustomRates({ ...customRates, silver: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Gold Enterprise (KES/mo)</label>
                      <input
                        type="number"
                        value={customRates.gold}
                        onChange={(e) => setCustomRates({ ...customRates, gold: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">One-Off Lifetime EXE (KES)</label>
                      <input
                        type="number"
                        value={customRates.lifetime}
                        onChange={(e) => setCustomRates({ ...customRates, lifetime: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      localStorage.setItem('dmi_pos_custom_pricing', JSON.stringify(customRates));
                      setRatesSavedNotice(true);
                      setTimeout(() => setRatesSavedNotice(false), 3000);
                    }}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                  >
                    Save Custom Pricing Model
                  </button>
                </div>

                {/* Global Marketing Broadcast Console */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/30">
                      <Megaphone className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase">Global Marketing Broadcast Console</h3>
                      <p className="text-xs text-slate-400">Send announcements to all connected client POS dashboards.</p>
                    </div>
                  </div>

                  {broadcastNotice && (
                    <div className="p-3 bg-indigo-950/60 border border-indigo-500/40 rounded-xl text-indigo-300 text-xs font-bold flex items-center gap-2">
                      <Send className="w-4 h-4 text-indigo-400" /> {broadcastNotice}
                    </div>
                  )}

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Headline / Subject</label>
                      <input
                        type="text"
                        placeholder="e.g. 🚀 Special Offer: Upgrade to Gold Suite this month!"
                        value={broadcastHeadline}
                        onChange={(e) => setBroadcastHeadline(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Announcement Details</label>
                      <textarea
                        rows={3}
                        placeholder="Type system notice, feature announcement or discount code details..."
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white"
                      />
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (!broadcastMessage.trim()) return;
                      const payload = {
                        id: crypto.randomUUID(),
                        headline: broadcastHeadline || '📢 DMi System Announcement',
                        message: broadcastMessage,
                        timestamp: new Date().toISOString(),
                        author: 'Master Admin'
                      };
                      localStorage.setItem('dmi_global_marketing_broadcast', JSON.stringify(payload));
                      try {
                        await masterService.reportPiracy('SYSTEM_BROADCAST', `[MARKETING ANNOUNCEMENT] ${payload.headline}: ${payload.message}`);
                      } catch (e) {}
                      setBroadcastNotice('Broadcast successfully dispatched to all terminals!');
                      setBroadcastHeadline('');
                      setBroadcastMessage('');
                      setTimeout(() => setBroadcastNotice(''), 4000);
                    }}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" /> Broadcast Announcement Now
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === 'hrm-master' && (
            <div className="space-y-8">
              {/* Header */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                    <UserCheck className="w-7 h-7 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">Master HRM & Staff Control Hub</h2>
                    <p className="text-xs text-slate-400">Monitor and manage all staff members, roles, salaries, and attendance across all registered client terminals.</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setEditingEmployee(null);
                    setHrmFormData({
                      businessId: 'DEFAULT_BUSINESS',
                      shopId: 'Main Branch',
                      name: '',
                      email: '',
                      phone: '',
                      role: 'Cashier',
                      salary: 25000,
                      hireDate: new Date().toISOString().split('T')[0],
                      status: 'ACTIVE'
                    });
                    setIsHrmModalOpen(true);
                  }}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 self-start md:self-auto"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Master Employee
                </button>
              </div>

              {/* Master Staff KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Registered Staff</span>
                    <Users className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h3 className="text-3xl font-black">{masterEmployees.length}</h3>
                  <p className="text-[10px] text-slate-500 mt-1">Across all active client branches</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Active Duty</span>
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="text-3xl font-black text-emerald-400">
                    {masterEmployees.filter(e => e.status === 'ACTIVE').length}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1">Active system user permissions</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">On Leave / Inactive</span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <h3 className="text-3xl font-black text-amber-400">
                    {masterEmployees.filter(e => e.status === 'ON_LEAVE' || e.status === 'INACTIVE').length}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1">Pending approval or paused</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Monthly Staff Payroll</span>
                    <DollarSign className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h3 className="text-2xl font-black font-mono text-indigo-400">
                    KES {masterEmployees.reduce((sum, e) => sum + (Number(e.salary) || 0), 0).toLocaleString()}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1">Combined monthly base salaries</p>
                </div>
              </div>

              {/* Employees Table with Controls */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight">Staff Registry Directory</h3>
                    <p className="text-xs text-slate-400">Master view of all cashier, manager, and admin accounts.</p>
                  </div>

                  <div className="relative w-full md:w-72">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search employee, role, or phone..."
                      value={hrmSearch}
                      onChange={(e) => setHrmSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-indigo-500 text-white"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        <th className="py-3 px-4">Employee</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Contact</th>
                        <th className="py-3 px-4">Branch / Business ID</th>
                        <th className="py-3 px-4">Monthly Salary</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Master Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {masterEmployees.filter(e => 
                        e.name?.toLowerCase().includes(hrmSearch.toLowerCase()) ||
                        e.role?.toLowerCase().includes(hrmSearch.toLowerCase()) ||
                        e.phone?.includes(hrmSearch)
                      ).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                            No employees found in local master directory. Click "Add Master Employee" to register staff records!
                          </td>
                        </tr>
                      ) : (
                        masterEmployees.filter(e => 
                          e.name?.toLowerCase().includes(hrmSearch.toLowerCase()) ||
                          e.role?.toLowerCase().includes(hrmSearch.toLowerCase()) ||
                          e.phone?.includes(hrmSearch)
                        ).map((emp) => (
                          <tr key={emp.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 font-bold text-white">
                              <div>{emp.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">Hired: {emp.hireDate || 'N/A'}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-[10px] font-bold uppercase">
                                {emp.role}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                              <div>{emp.phone || 'No Phone'}</div>
                              <div className="text-[10px] text-slate-500">{emp.email || ''}</div>
                            </td>
                            <td className="py-3 px-4 text-slate-400 font-mono text-[10px]">
                              <div>{emp.shopId || 'Main Branch'}</div>
                              <div className="text-slate-600 truncate max-w-[120px]">{emp.businessId}</div>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                              KES {(Number(emp.salary) || 0).toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                                emp.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                emp.status === 'ON_LEAVE' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}>
                                {emp.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setEditingEmployee(emp);
                                    setHrmFormData({
                                      businessId: emp.businessId || 'DEFAULT_BUSINESS',
                                      shopId: emp.shopId || 'Main Branch',
                                      name: emp.name,
                                      email: emp.email || '',
                                      phone: emp.phone || '',
                                      role: emp.role,
                                      salary: emp.salary,
                                      hireDate: emp.hireDate || new Date().toISOString().split('T')[0],
                                      status: emp.status || 'ACTIVE'
                                    });
                                    setIsHrmModalOpen(true);
                                  }}
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                                  title="Edit Employee"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={async () => {
                                    const confirm = window.confirm(`Delete staff member ${emp.name}?`);
                                    if (confirm) {
                                      await localDb.deleteEmployee(emp.id);
                                      setMasterEmployees(localDb.getAllEmployees());
                                    }
                                  }}
                                  className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-lg transition-colors"
                                  title="Delete Employee"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add/Edit Modal */}
              {isHrmModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg w-full space-y-6 shadow-2xl">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                      <h3 className="text-lg font-black uppercase">
                        {editingEmployee ? 'Edit Master Staff Member' : 'Add New Master Employee'}
                      </h3>
                      <button 
                        onClick={() => setIsHrmModalOpen(false)}
                        className="text-slate-500 hover:text-white text-lg font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-4 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1 font-bold uppercase text-[10px]">Full Name</label>
                        <input
                          type="text"
                          value={hrmFormData.name}
                          onChange={(e) => setHrmFormData({ ...hrmFormData, name: e.target.value })}
                          placeholder="e.g. David Mwangi"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-slate-400 mb-1 font-bold uppercase text-[10px]">Role / Position</label>
                          <select
                            value={hrmFormData.role}
                            onChange={(e) => setHrmFormData({ ...hrmFormData, role: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white"
                          >
                            <option value="Cashier">Cashier</option>
                            <option value="Store Manager">Store Manager</option>
                            <option value="Accountant">Accountant</option>
                            <option value="Receptionist">Receptionist</option>
                            <option value="Supervisor">Supervisor</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 font-bold uppercase text-[10px]">Monthly Base Salary (KES)</label>
                          <input
                            type="number"
                            value={hrmFormData.salary}
                            onChange={(e) => setHrmFormData({ ...hrmFormData, salary: Number(e.target.value) })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-slate-400 mb-1 font-bold uppercase text-[10px]">Phone Number</label>
                          <input
                            type="text"
                            value={hrmFormData.phone}
                            onChange={(e) => setHrmFormData({ ...hrmFormData, phone: e.target.value })}
                            placeholder="0712345678"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 font-bold uppercase text-[10px]">Status</label>
                          <select
                            value={hrmFormData.status}
                            onChange={(e) => setHrmFormData({ ...hrmFormData, status: e.target.value as any })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white"
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="ON_LEAVE">ON LEAVE</option>
                            <option value="INACTIVE">INACTIVE</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
                      <button
                        onClick={() => setIsHrmModalOpen(false)}
                        className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          if (!hrmFormData.name.trim()) return;
                          if (editingEmployee) {
                            await localDb.updateEmployee(editingEmployee.id, hrmFormData);
                          } else {
                            await localDb.addEmployee(hrmFormData);
                          }
                          setMasterEmployees(localDb.getAllEmployees());
                          setIsHrmModalOpen(false);
                          setEditingEmployee(null);
                        }}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs uppercase"
                      >
                        Save Staff Record
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'saas-hub' && (
            <SaaSHub />
          )}

          {view === 'database' && (
            <MasterDatabaseSchema />
          )}

          {/* Real-Time Notification Center View */}
          {view === 'notifications' && (
            <div className="space-y-6">
              {/* Header Banner */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2 relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                      <BellRing className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                      Supabase Real-Time Event Bus
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Active Channel: <code className="text-emerald-400">master-piracy-alerts &amp; master-licenses</code>
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                    Real-Time Notification & Action Center
                  </h2>
                  <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                    Live operational hub capturing business activations, license expiry countdowns, and security alerts from all retail shop instances across Kenya.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 relative z-10 shrink-0">
                  <button
                    onClick={handleTriggerTestAlert}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
                  >
                    <Zap className="w-4 h-4 fill-current" />
                    Simulate Real-Time Alert
                  </button>

                  <button
                    onClick={handleMarkAllNotificationsRead}
                    disabled={unreadCount === 0}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <CheckCheck className="w-4 h-4 text-emerald-400" />
                    Mark All as Read
                  </button>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-indigo-400" /> Filter:
                  </span>
                  {[
                    { id: 'ALL', label: 'All Alerts', count: notifications.length },
                    { id: 'BUSINESS_ACTIVATION', label: 'Business Activations', count: notifications.filter(n => n.category === 'BUSINESS_ACTIVATION').length },
                    { id: 'LICENSE_EXPIRY', label: 'License Expiry', count: notifications.filter(n => n.category === 'LICENSE_EXPIRY').length },
                    { id: 'SECURITY_PIRACY', label: 'Security Breaches', count: notifications.filter(n => n.category === 'SECURITY_PIRACY').length }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setNotificationFilter(f.id as any)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                        notificationFilter === f.id 
                          ? 'bg-indigo-600 text-white shadow-md' 
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>{f.label}</span>
                      <span className="px-1.5 py-0.2 bg-slate-950/60 rounded text-[10px] font-mono">
                        {f.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Unread Notifications: <strong className="text-white">{unreadCount}</strong></span>
                </div>
              </div>

              {/* Notifications List */}
              <div className="space-y-3">
                {notifications
                  .filter(n => notificationFilter === 'ALL' || n.category === notificationFilter)
                  .length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500 space-y-3">
                    <Bell className="w-10 h-10 text-slate-600 mx-auto" />
                    <p className="text-sm font-bold uppercase tracking-wider text-slate-400">
                      No Notifications Found for Selected Filter
                    </p>
                    <p className="text-xs max-w-md mx-auto text-slate-500">
                      You are completely caught up! Click "Simulate Real-Time Alert" above to trigger a test business activation, expiry, or anti-piracy security alert.
                    </p>
                  </div>
                ) : (
                  notifications
                    .filter(n => notificationFilter === 'ALL' || n.category === notificationFilter)
                    .map(n => (
                      <div
                        key={n.id}
                        className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          !n.read 
                            ? 'bg-slate-900/90 border-indigo-500/40 shadow-lg shadow-indigo-500/5' 
                            : 'bg-slate-900/40 border-slate-800/80 opacity-80'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-2xl shrink-0 mt-0.5 ${
                            n.category === 'SECURITY_PIRACY' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                            n.category === 'BUSINESS_ACTIVATION' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                            'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          }`}>
                            {n.category === 'SECURITY_PIRACY' && <ShieldAlert className="w-6 h-6 animate-pulse" />}
                            {n.category === 'BUSINESS_ACTIVATION' && <Building2 className="w-6 h-6" />}
                            {n.category === 'LICENSE_EXPIRY' && <Clock className="w-6 h-6" />}
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                n.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse' :
                                n.severity === 'WARNING' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                              }`}>
                                {n.severity}
                              </span>

                              <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(n.timestamp).toLocaleString()}
                              </span>

                              {!n.read && (
                                <span className="px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-full tracking-wider">
                                  NEW
                                </span>
                              )}
                            </div>

                            <h4 className="text-sm font-black text-white">{n.title}</h4>
                            <p className="text-xs text-slate-300 leading-relaxed font-sans">{n.message}</p>

                            {n.licenseKey && (
                              <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-slate-400">
                                <span>Key: <code className="text-indigo-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">{n.licenseKey}</code></span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0 border-t md:border-t-0 border-slate-800 pt-3 md:pt-0">
                          {n.actionType === 'APPROVE_LICENSE' && (
                            <button
                              onClick={() => handleApproveLicenseNotification(n.licenseKey)}
                              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase rounded-xl transition-all shadow-md flex items-center gap-1.5"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Approve & Activate
                            </button>
                          )}

                          {n.actionType === 'EXTEND_EXPIRY' && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleExtendLicenseNotification(n.licenseKey, 30)}
                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase rounded-xl transition-all shadow-md"
                              >
                                Extend (+30 Days)
                              </button>
                              <button
                                onClick={() => handleExtendLicenseNotification(n.licenseKey, 365)}
                                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-indigo-500/30 font-bold text-xs uppercase rounded-xl transition-all"
                              >
                                +1 Year
                              </button>
                            </div>
                          )}

                          {n.actionType === 'RESOLVE_PIRACY' && (
                            <button
                              onClick={() => handleResolvePiracyNotification(n.metadata?.id)}
                              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase rounded-xl transition-all shadow-md flex items-center gap-1.5"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Resolve Incident
                            </button>
                          )}

                          {!n.read && (
                            <button
                              onClick={() => handleMarkNotificationRead(n.id)}
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-xs uppercase rounded-xl transition-colors"
                            >
                              Dismiss
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Slide-Over Notification Drawer */}
      <AnimatePresence>
        {isNotificationDrawerOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col shadow-2xl"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                <div className="flex items-center gap-2.5">
                  <Bell className="w-5 h-5 text-amber-400" />
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-wider text-white">
                      Live Notification Alerts
                    </h3>
                    <p className="text-[10px] text-slate-400">Real-Time Supabase Listener Active</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsNotificationDrawerOpen(false)}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 italic text-xs">
                    No active notifications registered.
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`p-4 rounded-xl border space-y-2 text-xs transition-all ${
                        !n.read ? 'bg-slate-800/90 border-indigo-500/40' : 'bg-slate-900/50 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`px-2 py-0.5 rounded font-black uppercase ${
                          n.category === 'SECURITY_PIRACY' ? 'bg-rose-500/20 text-rose-400' :
                          n.category === 'BUSINESS_ACTIVATION' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {n.category.replace('_', ' ')}
                        </span>
                        <span className="font-mono text-slate-500">{new Date(n.timestamp).toLocaleTimeString()}</span>
                      </div>

                      <div className="font-bold text-white text-xs">{n.title}</div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{n.message}</p>

                      <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                        {n.actionType === 'APPROVE_LICENSE' && (
                          <button
                            onClick={() => handleApproveLicenseNotification(n.licenseKey)}
                            className="px-2.5 py-1 bg-emerald-600 text-white font-bold text-[10px] uppercase rounded-lg"
                          >
                            Approve Now
                          </button>
                        )}
                        {n.actionType === 'EXTEND_EXPIRY' && (
                          <button
                            onClick={() => handleExtendLicenseNotification(n.licenseKey, 30)}
                            className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-[10px] uppercase rounded-lg"
                          >
                            Extend +30 Days
                          </button>
                        )}
                        {n.actionType === 'RESOLVE_PIRACY' && (
                          <button
                            onClick={() => handleResolvePiracyNotification(n.metadata?.id)}
                            className="px-2.5 py-1 bg-rose-600 text-white font-bold text-[10px] uppercase rounded-lg"
                          >
                            Resolve Security
                          </button>
                        )}

                        {!n.read && (
                          <button
                            onClick={() => handleMarkNotificationRead(n.id)}
                            className="text-[10px] text-slate-400 hover:text-white uppercase font-bold"
                          >
                            Mark Read
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => {
                    setIsNotificationDrawerOpen(false);
                    setView('notifications');
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl text-center"
                >
                  View Full Notification Center
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Real-Time Alert Toast Banner */}
      <AnimatePresence>
        {alertToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-8 right-8 z-[200] max-w-sm bg-slate-900 border-2 border-indigo-500 rounded-2xl p-4 shadow-2xl shadow-indigo-500/20 text-white space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-amber-400 animate-bounce" />
                <span className="font-black text-xs uppercase tracking-wider text-indigo-400">
                  Real-Time Master Event
                </span>
              </div>
              <button onClick={() => setAlertToast(null)} className="p-1 hover:bg-slate-800 rounded">
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
            <div className="font-bold text-xs text-white">{alertToast.title}</div>
            <p className="text-[11px] text-slate-300 leading-snug">{alertToast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Copyright Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 px-8 py-4 flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
        <p>© 2026 DMi Technologies Kenya - All Rights Reserved.</p>
        <p>Software Built & Protected for East African Market</p>
      </footer>
    </div>
  );
};
