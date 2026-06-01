import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Sale, Alert, Product, UserProfile, LoginHistory, BusinessProfile } from '../types';
import { 
  TrendingUp, 
  ShoppingBag, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  History,
  UserCheck,
  Users,
  Printer,
  Download,
  Trash2
} from 'lucide-react';
import { format, startOfDay, isToday, subDays, isSameDay, eachDayOfInterval } from 'date-fns';
import { 
  PieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { printElement } from '../lib/printUtils';

interface DashboardProps {
  user: UserProfile;
  businessId: string;
  shopId: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, businessId, shopId }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [staffDateRange, setStaffDateRange] = useState<'today' | '7days' | '30days' | 'thisMonth'>('7days');
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [alertToDelete, setAlertToDelete] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [s, a, p, h, b, ex] = await Promise.all([
        db.getSales(businessId, shopId),
        db.getAlerts(businessId, shopId),
        db.getProducts(businessId, shopId),
        db.getLoginHistory(),
        db.getBusinessById(businessId),
        db.getExpenses(businessId, shopId)
      ]);
      setSales(s);
      setAlerts(a);
      setProducts(p);
      setLoginHistory(h);
      setBusinessProfile(b || null);
      setExpenses(ex);
    };
    
    fetchData();
    const handleBusinessUpdate = (e: any) => {
      if (e.detail?.id === businessId) {
        setBusinessProfile(prev => prev ? { ...prev, ...e.detail.updates } : null);
      }
    };

    const handleDataUpdate = (e: any) => {
      // Keys that should trigger a re-fetch in Dashboard
      const relevantKeys = [
        'dmi_pos_sales',
        'dmi_pos_expenses',
        'dmi_pos_products',
        'dmi_pos_alerts',
        'dmi_pos_businesses'
      ];
      if (relevantKeys.includes(e.detail?.key)) {
        fetchData();
      }
    };

    const handleSyncComplete = () => {
      fetchData();
    };

    window.addEventListener('business-update', handleBusinessUpdate);
    window.addEventListener('local-db-update', handleDataUpdate);
    window.addEventListener('storage-sync', handleDataUpdate);
    window.addEventListener('sync-completed', handleSyncComplete);
    
    const interval = setInterval(fetchData, 30000); // Polling as backup
    return () => {
      clearInterval(interval);
      window.removeEventListener('business-update', handleBusinessUpdate);
      window.removeEventListener('local-db-update', handleDataUpdate);
      window.removeEventListener('storage-sync', handleDataUpdate);
      window.removeEventListener('sync-completed', handleSyncComplete);
    };
  }, [businessId, shopId]);

  const formatCurrency = (amount: number | undefined | null) => {
    const currency = businessProfile?.currency || 'KSh';
    if (amount === undefined || amount === null) return `${currency}0`;
    return `${currency}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const todaySales = sales.filter(s => isToday(new Date(s.timestamp)));
  const todayExpenses = expenses.filter(e => isToday(new Date(e.date)));

  const totalRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const totalCOGS = todaySales.reduce((sum, s) => {
    return sum + s.items.reduce((itemSum, item) => {
      const buyingPrice = item.buyingPrice || 0;
      return itemSum + (buyingPrice * item.quantity);
    }, 0);
  }, 0);

  const todayGrossProfit = totalRevenue - totalCOGS;
  const todayExpenseTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalNetProfit = todayGrossProfit - todayExpenseTotal;
  const totalOrders = todaySales.length;

  // Calculate trends based on yesterday
  const yesterday = subDays(new Date(), 1);
  const yesterdaySales = sales.filter(s => isSameDay(new Date(s.timestamp), yesterday));
  const yesterdayExpenses = expenses.filter(e => isSameDay(new Date(e.date), yesterday));

  const yesterdayRevenue = yesterdaySales.reduce((sum, s) => sum + s.total, 0);
  const yesterdayCOGS = yesterdaySales.reduce((sum, s) => {
    return sum + s.items.reduce((itemSum, item) => {
      const buyingPrice = item.buyingPrice || 0;
      return itemSum + (buyingPrice * item.quantity);
    }, 0);
  }, 0);

  const yesterdayGrossProfit = yesterdayRevenue - yesterdayCOGS;
  const yesterdayExpenseTotal = yesterdayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const yesterdayNetProfit = yesterdayGrossProfit - yesterdayExpenseTotal;
  const yesterdayOrders = yesterdaySales.length;

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '0%';
    const diff = ((current - previous) / previous) * 100;
    return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
  };

  const lowStockCount = products.filter(p => 
    p.variants.some(v => v.stock <= (v.lowStockThreshold ?? p.lowStockThreshold))
  ).length;
  const unreadAlerts = alerts.filter(a => a.status === 'UNREAD');

  const [staffData, setStaffData] = useState<any[]>([]);

  useEffect(() => {
    const calculateStaffPerformance = async () => {
      const filteredSalesForStaff = sales.filter(s => {
        const date = new Date(s.timestamp);
        if (staffDateRange === 'today') return isToday(date);
        if (staffDateRange === '7days') return date >= subDays(new Date(), 7);
        if (staffDateRange === '30days') return date >= subDays(new Date(), 30);
        if (staffDateRange === 'thisMonth') return date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear();
        return true;
      });

      const users = await db.getUsers();
      const performance = filteredSalesForStaff.reduce((acc, sale) => {
        const { cashierId, cashierName, total } = sale;
        if (!acc[cashierId]) {
          const staffUser = users.find(u => u.uid === cashierId);
          acc[cashierId] = { name: cashierName, role: staffUser?.role || 'staff', totalSales: 0, transactions: 0 };
        }
        acc[cashierId].totalSales += total;
        acc[cashierId].transactions += 1;
        return acc;
      }, {} as Record<string, { name: string, role: string, totalSales: number, transactions: number }>);

      const data = Object.entries(performance).map(([id, d]) => ({
        id,
        ...d,
        avgValue: d.transactions > 0 ? d.totalSales / d.transactions : 0
      })).sort((a, b) => b.totalSales - a.totalSales);

      setStaffData(data);
    };

    calculateStaffPerformance();
  }, [sales, staffDateRange]);

  const markAlertRead = async (id: string) => {
    await db.updateAlert(id, { status: 'READ' });
    const freshAlerts = await db.getAlerts(businessId, shopId);
    setAlerts(freshAlerts);
  };

  const handlePrint = () => {
    printElement('print-dashboard-container', false);
  };

  const handleDeleteAlert = (id: string) => {
    setAlertToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteAlert = async () => {
    if (alertToDelete) {
      await db.deleteAlert(alertToDelete);
      const freshAlerts = await db.getAlerts(businessId, shopId);
      setAlerts(freshAlerts);
      setAlertToDelete(null);
      setIsDeleteModalOpen(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Transaction ID', 'Cashier', 'Payment', 'Total'];
    const rows = sales.map(s => [
      format(new Date(s.timestamp), 'yyyy-MM-dd HH:mm'),
      s.id,
      s.cashierName,
      s.paymentMethod,
      s.total.toString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sales_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Prepare chart data for Pie Charts
  const salesByCategory = todaySales.reduce((acc, sale) => {
    sale.items.forEach(item => {
      const category = item.category || 'Uncategorized';
      acc[category] = (acc[category] || 0) + (item.price * item.quantity);
    });
    return acc;
  }, {} as Record<string, number>);

  const categoryPieData = Object.entries(salesByCategory).map(([name, value]) => ({ name, value }));

  // Weekly Sales Data
  const last7Days = eachDayOfInterval({
    start: subDays(new Date(), 6),
    end: new Date()
  });

  const weeklySalesData = last7Days.map(day => {
    const daySales = sales.filter(s => isSameDay(new Date(s.timestamp), day));
    return {
      name: format(day, 'EEE'),
      value: daySales.reduce((sum, s) => sum + s.total, 0),
    };
  });

  const COLORS = [
    'var(--primary-color)',
    'var(--secondary-color)',
    'var(--accent-color)',
    '#f59e0b',
    '#ef4444',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899'
  ];

  const stats = [
    { label: "Today's Revenue", value: formatCurrency(totalRevenue), icon: DollarSign, color: 'bg-primary', trend: calculateTrend(totalRevenue, yesterdayRevenue) },
    { label: "Today's Net Profit", value: formatCurrency(totalNetProfit), icon: TrendingUp, color: 'bg-accent', trend: calculateTrend(totalNetProfit, yesterdayNetProfit) },
    { label: "Today's Orders", value: totalOrders, icon: ShoppingBag, color: 'bg-secondary', trend: calculateTrend(totalOrders, yesterdayOrders) },
    { label: "Low Stock Items", value: lowStockCount, icon: Package, color: 'bg-accent', trend: lowStockCount > 0 ? 'Critical' : 'Good' },
  ];

  return (
    <div id="print-dashboard-container" className="space-y-8">
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold">{businessProfile?.name || 'Business'} - Business Overview Report</h1>
        <p className="text-gray-500">Generated on: {format(new Date(), 'MMMM do, yyyy HH:mm')}</p>
        <hr className="mt-4 border-border" />
      </div>

      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-ink">Welcome to DMi Technologies</h2>
          <p className="text-sm text-muted">Welcome back, {user.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2.5 bg-card border border-border hover:bg-muted text-ink font-bold rounded-xl transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-6 py-2.5 bg-black text-white hover:bg-black/90 font-bold rounded-xl transition-all shadow-lg"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-card p-6 rounded-3xl border border-border shadow-sm hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-2xl ${stat.color} text-white shadow-lg`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                stat.trend.startsWith('+') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
              }`}>
                {stat.trend}
              </span>
            </div>
            <p className="text-muted text-sm font-medium">{stat.label}</p>
            <h3 className="text-2xl font-bold text-ink mt-1">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-card p-8 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-ink">Sales by Category</h3>
              <p className="text-sm text-muted">Revenue distribution for today</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full">
              <Clock className="w-3 h-3" />
              TODAY
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--ink)' }}
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-card p-8 rounded-3xl border border-border shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-ink">Recent Alerts</h3>
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Latest 50</span>
          </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {alerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted gap-3 py-12">
                <div className="w-16 h-16 bg-bg rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 opacity-20" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-ink">All systems clear</p>
                  <p className="text-xs text-muted">No active stock or price alerts</p>
                </div>
              </div>
            ) : (
              alerts.map(alert => (
                <div 
                  key={alert.id} 
                  className={`p-4 rounded-2xl border transition-all ${
                    alert.status === 'UNREAD' 
                      ? 'bg-rose-500/10 border-rose-500/20' 
                      : 'bg-bg border-border opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl ${
                      alert.type === 'PRICE_OVERRIDE' ? 'bg-amber-500/20 text-amber-500' : 'bg-rose-500/20 text-rose-500'
                    }`}>
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-ink">{alert.type.replace('_', ' ')}</p>
                        <button 
                          onClick={() => handleDeleteAlert(alert.id)}
                          className="p-1 text-muted hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-xs text-muted leading-relaxed">{alert.message}</p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-[10px] text-muted font-medium">
                          {format(new Date(alert.timestamp), 'MMM d, HH:mm')}
                        </span>
                        {alert.status === 'UNREAD' && (
                          <button 
                            onClick={() => markAlertRead(alert.id)}
                            className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Weekly Analytics Chart */}
      <div className="bg-card p-8 rounded-3xl border border-border shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-bold text-ink">Weekly Revenue Distribution</h3>
            <p className="text-sm text-muted">Revenue share for the past 7 days</p>
          </div>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={weeklySalesData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {weeklySalesData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--card)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '16px', 
                  color: 'var(--ink)',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
              />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">Recent Transactions</h3>
          <button className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline">View All</button>
        </div>
        <div className="overflow-x-auto">
          {todaySales.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-muted gap-4">
              <div className="w-20 h-20 bg-bg rounded-full flex items-center justify-center">
                <ShoppingBag className="w-10 h-10 opacity-20" />
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-ink">No transactions today</p>
                <p className="text-sm text-muted">Sales will appear here as they happen</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg text-xs font-bold text-muted uppercase tracking-wider">
                <th className="px-8 py-4">Order ID</th>
                <th className="px-8 py-4">Cashier</th>
                <th className="px-8 py-4">Customer</th>
                <th className="px-8 py-4">Items</th>
                <th className="px-8 py-4">Total</th>
                <th className="px-8 py-4">Time</th>
                <th className="px-8 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sales.slice(0, 5).map(sale => {
                const isDebtPayment = sale.items.some(item => item.productId === 'DEBT_PAYMENT');
                return (
                  <tr key={sale.id} className="hover:bg-bg transition-colors">
                    <td className="px-8 py-4 font-mono text-xs text-muted">#{sale.id.slice(-8).toUpperCase()}</td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                          {(sale.cashierName || 'S').charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-ink">{sale.cashierName || 'Staff'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <span className="text-sm text-ink">{sale.customerName || 'Walk-in'}</span>
                    </td>
                    <td className="px-8 py-4">
                      {isDebtPayment ? (
                        <span className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          Debt Payment
                        </span>
                      ) : (
                        <span className="text-sm text-muted">{sale.items.length} items</span>
                      )}
                    </td>
                    <td className="px-8 py-4 font-bold text-ink">{formatCurrency(sale.total)}</td>
                    <td className="px-8 py-4 text-xs text-muted">{format(new Date(sale.timestamp), 'HH:mm')}</td>
                    <td className="px-8 py-4 text-right">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                        isDebtPayment ? 'bg-emerald-500/10 text-emerald-500' : 
                        sale.paymentMethod === 'DEBT' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-emerald-500/10 text-emerald-500'
                      }`}>
                        {isDebtPayment ? 'PAID' : sale.paymentMethod === 'DEBT' ? 'CREDIT' : 'COMPLETED'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>
      </div>
      {/* Staff Performance Section */}
      {user.role === 'admin' && (
        <div className="bg-card p-8 rounded-3xl border border-border shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-ink">Staff Performance</h3>
                <p className="text-sm text-muted">Sales metrics by individual staff members</p>
              </div>
            </div>
            <div className="flex bg-sky-500/10 dark:bg-sky-500/15 p-1 rounded-xl border border-sky-500/30">
              {(['today', '7days', '30days', 'thisMonth'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setStaffDateRange(range)}
                  className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${
                    staffDateRange === range 
                      ? 'bg-sky-500/25 text-black border border-sky-500/40 shadow-sm' 
                      : 'text-black/70 hover:text-black hover:bg-sky-500/15'
                  }`}
                >
                  {range === 'today' ? 'Today' : range === '7days' ? 'Last 7 Days' : range === '30days' ? 'Last 30 Days' : 'Monthly'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            <div className="lg:col-span-2 bg-bg border border-border rounded-2xl p-6">
              <h4 className="text-sm font-bold text-ink uppercase tracking-wider mb-6">Revenue Distribution by Staff</h4>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={staffData.map(s => ({ name: s.name, value: s.totalSales }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {staffData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--ink)' }}
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-bg border border-border rounded-2xl p-6 flex flex-col justify-center text-center">
              <div className="w-16 h-16 bg-accent/10 text-accent rounded-2xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-muted uppercase tracking-widest mb-2">Top Performer</h4>
              {staffData.length > 0 ? (
                <>
                  <p className="text-2xl font-black text-ink mb-1">{staffData[0].name || 'Top Staff'}</p>
                  <p className="text-accent font-bold">{formatCurrency(staffData[0].totalSales)}</p>
                  <div className="mt-6 pt-6 border-t border-border">
                    <p className="text-[10px] font-bold text-muted uppercase mb-1">Efficiency</p>
                    <p className="text-xl font-bold text-ink">
                      {((staffData[0].totalSales / (totalRevenue || 1)) * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted mt-1">of total revenue</p>
                  </div>
                </>
              ) : (
                <p className="text-muted italic">No data available</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {staffData.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted italic text-sm">
                No sales data found for this period
              </div>
            ) : (
              staffData.map((staff) => (
                <div key={staff.id} className="p-6 bg-bg border border-border rounded-2xl hover:border-primary/30 transition-all group">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                      {(staff.name || 'S').charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-ink">{staff.name || 'Staff'}</h4>
                      <p className={`text-[10px] font-bold uppercase ${
                  staff.role === 'admin' ? 'text-primary' : 'text-muted'
                }`}>{staff.role === 'admin' ? 'Admin' : 'Staff'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-muted uppercase mb-1">Sales</p>
                      <p className="text-sm font-bold text-ink">{formatCurrency(staff.totalSales)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-muted uppercase mb-1">Orders</p>
                      <p className="text-sm font-bold text-ink">{staff.transactions}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-muted uppercase mb-1">Avg. Value</p>
                      <p className="text-sm font-bold text-ink">{formatCurrency(staff.avgValue)}</p>
                    </div>
                  </div>
                  <div className="mt-6 h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-1000" 
                      style={{ width: `${Math.min(100, (staff.totalSales / (totalRevenue || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Login History */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setAlertToDelete(null);
        }}
        onConfirm={confirmDeleteAlert}
        title="Clear Alert"
        message="Are you sure you want to clear this alert?"
      />
      {user.role === 'admin' && (
        <div className="bg-card p-8 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-ink">User Login History</h3>
                <p className="text-sm text-muted">Monitor staff and admin access</p>
              </div>
            </div>
            <button className="text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:underline print:hidden">View All</button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-border">
                  <th className="pb-4 text-xs font-bold text-muted uppercase tracking-wider">User</th>
                  <th className="pb-4 text-xs font-bold text-muted uppercase tracking-wider">Role</th>
                  <th className="pb-4 text-xs font-bold text-muted uppercase tracking-wider">Device/Browser</th>
                  <th className="pb-4 text-xs font-bold text-muted uppercase tracking-wider">Login Time</th>
                  <th className="pb-4 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loginHistory.slice(0, 10).map((history) => (
                  <tr key={history.id} className="group hover:bg-bg transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-bg rounded-full flex items-center justify-center text-xs font-bold text-muted">
                          {(history.userName || 'U').charAt(0)}
                        </div>
                        <span className="text-sm font-semibold text-ink">{history.userName || 'User'}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <span className={`text-[10px] px-2 py-1 rounded-lg font-bold uppercase ${
                        history.role === 'admin' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-bg text-muted'
                      }`}>
                        {history.role === 'admin' ? 'Admin' : 'Staff'}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex flex-col">
                        <span className="text-xs text-ink font-medium">{history.device}</span>
                        <span className="text-[10px] text-muted">{history.browser} • {history.ipAddress}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <span className="text-sm text-muted">{format(new Date(history.timestamp), 'MMM d, HH:mm')}</span>
                    </td>
                    <td className="py-4">
                      <div className={`flex items-center gap-2 ${history.status === 'SUCCESS' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {history.status === 'SUCCESS' ? <UserCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        <span className="text-xs font-bold">{history.status}</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {loginHistory.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted text-sm italic">
                      No login history records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
