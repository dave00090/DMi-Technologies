import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  Printer, 
  Download, 
  Calendar,
  Filter,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  ShoppingCart,
  Package,
  Trash2,
  UserCheck,
  PieChart as PieChartIcon,
  X,
  Share2,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, isWithinInterval, differenceInDays } from 'date-fns';
import { 
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { db } from '../services/db';
import { BusinessProfile, Shop, Product, Sale, Payroll } from '../types';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { Receipt } from './Receipt';
import { printElement } from '../lib/printUtils';

interface ReportsProps {
  businessProfile: BusinessProfile;
  shop: Shop | null;
}

type ReportType = 'sales' | 'profit' | 'inventory' | 'staff' | 'attendance' | 'inventoryValue' | 'payroll';

export const Reports: React.FC<ReportsProps> = ({ businessProfile, shop }) => {
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfDay(new Date()), 'yyyy-MM-dd'));
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  
  const [salesData, setSalesData] = useState<Sale[]>([]);
  const [profitData, setProfitData] = useState<any>({ totalRevenue: 0, totalCost: 0, totalExpenses: 0, grossProfit: 0, netProfit: 0 });
  const [staffPerformance, setStaffPerformance] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [inventoryValueData, setInventoryValueData] = useState<any>({ totalBuyingValue: 0, totalSellingValue: 0, totalItems: 0, potentialProfit: 0 });
  const [payrollData, setPayrollData] = useState<Payroll[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const start = startOfDay(new Date(startDate));
      const end = endOfDay(new Date(endDate));

      const [sales, profit, staff, allProducts, payroll, emps, attendance] = await Promise.all([
        db.getSalesReport(businessProfile.id, start, end, shop?.id),
        db.getProfitLossReport(businessProfile.id, start, end, shop?.id),
        db.getStaffPerformance(businessProfile.id, start, end, shop?.id),
        db.getProducts(businessProfile.id, shop?.id),
        db.getPayrollReport(businessProfile.id, start, end, shop?.id),
        db.getEmployees(businessProfile.id),
        db.getAllAttendance()
      ]);

      setSalesData(sales);
      setProfitData(profit);
      setStaffPerformance(staff);
      setProducts(allProducts);
      setPayrollData(payroll);
      setEmployees(emps);

      // Process Attendance for Report
      const employeeMap = new Map(emps.map(e => [e.id, e]));
      const filteredAttendance = attendance.filter(a => {
        const date = new Date(a.date);
        return date >= start && date <= end && employeeMap.has(a.employeeId);
      });

      const attendanceReport = emps.map(emp => {
        const empAttendance = filteredAttendance.filter(a => a.employeeId === emp.id);
        const presentCount = empAttendance.filter(a => a.status === 'PRESENT').length;
        const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const percentage = Math.round((presentCount / totalDays) * 100);
        return {
          id: emp.id,
          name: emp.name,
          role: emp.role,
          present: presentCount,
          absent: totalDays - presentCount,
          percentage
        };
      });
      setAttendanceData(attendanceReport);

      // Inventory Logic
      const lowStock = allProducts.filter(p => {
        return p.variants.some(v => {
          const threshold = v.lowStockThreshold ?? p.lowStockThreshold;
          return v.stock <= threshold;
        });
      });
      setLowStockProducts(lowStock);

      let totalBuyingValue = 0;
      let totalSellingValue = 0;
      let totalItems = 0;

      allProducts.forEach(p => {
        const stock = p.variants.reduce((sum, v) => sum + v.stock, 0);
        totalBuyingValue += stock * (p.buyingPrice || 0);
        totalSellingValue += stock * (p.sellingPrice || p.basePrice);
        totalItems += stock;
      });

      setInventoryValueData({ totalBuyingValue, totalSellingValue, totalItems, potentialProfit: totalSellingValue - totalBuyingValue });
    };
    fetchData();

    const handleDataUpdate = (e: any) => {
      const keys = ['dmi_pos_sales', 'dmi_pos_expenses', 'dmi_pos_products', 'dmi_pos_employees', 'dmi_pos_payroll'];
      if (keys.includes(e.detail?.key)) {
        fetchData();
      }
    };

    window.addEventListener('local-db-update', handleDataUpdate);
    window.addEventListener('storage-sync', handleDataUpdate);

    return () => {
      window.removeEventListener('local-db-update', handleDataUpdate);
      window.removeEventListener('storage-sync', handleDataUpdate);
    };
  }, [businessProfile.id, shop?.id, startDate, endDate]);

  const formatCurrency = (amount: number | undefined | null, options?: Intl.NumberFormatOptions) => {
    const currency = businessProfile?.currency || 'KSh';
    if (amount === undefined || amount === null) return `${currency} 0`;
    return `${currency} ${amount.toLocaleString(undefined, options)}`;
  };

  const handlePrintReport = () => {
    printElement('print-report-container', false);
  };

  const handlePrintReceipt = () => {
    printElement('print-receipt', true);
  };

  const handleShareReceipt = async () => {
    if (!selectedSale) return;
    const shareData = {
      title: `Receipt from ${businessProfile.name} - ${selectedSale.id.slice(-8).toUpperCase()}`,
      text: `Receipt for ${businessProfile.currency}${selectedSale.total.toFixed(2)} at ${businessProfile.name}.`,
      url: `${window.location.origin}/?saleId=${selectedSale.id}`
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        alert('Receipt link copied to clipboard!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const totalPayroll = payrollData.reduce((sum, p) => sum + p.netSalary, 0);

  const handleDeleteSale = (id: string) => {
    setSaleToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteSale = async () => {
    if (saleToDelete) {
      await db.deleteSale(saleToDelete);
      alert('Transaction deleted successfully.');
      // Refetch data
      const start = startOfDay(new Date(startDate));
      const end = endOfDay(new Date(endDate));
      const freshSales = await db.getSalesReport(businessProfile.id, start, end, shop?.id);
      setSalesData(freshSales);
      setSaleToDelete(null);
      setIsDeleteModalOpen(false);
    }
  };

  const handleExportCSV = async () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = `report_${reportType}_${format(new Date(), 'yyyy-MM-dd')}.csv`;

    if (reportType === 'sales') {
      headers = ['Date', 'Transaction ID', 'Cashier', 'Payment Method', 'Items Count', 'Total'];
      rows = salesData.map(s => [
        format(new Date(s.timestamp), 'yyyy-MM-dd HH:mm'),
        s.id,
        s.cashierName,
        s.paymentMethod,
        s.items.length.toString(),
        s.total.toString()
      ]);
    } else if (reportType === 'profit') {
      headers = ['Metric', 'Value'];
      rows = [
        ['Total Revenue', profitData.totalRevenue.toString()],
        ['Total Cost', profitData.totalCost.toString()],
        ['Total Expenses', profitData.totalExpenses.toString()],
        ['Gross Profit', profitData.grossProfit.toString()],
        ['Net Profit', profitData.netProfit.toString()]
      ];
    } else if (reportType === 'inventory' || reportType === 'inventoryValue') {
      headers = ['Product', 'Category', 'Stock', 'Buying Price', 'Selling Price', 'Total Value'];
      rows = products.map(p => {
        const stock = p.variants.reduce((sum, v) => sum + v.stock, 0);
        return [
          p.name,
          p.category,
          stock.toString(),
          (p.buyingPrice || 0).toString(),
          (p.sellingPrice || p.basePrice).toString(),
          (stock * (p.sellingPrice || p.basePrice)).toString()
        ];
      });
    } else if (reportType === 'staff') {
      headers = ['Staff Name', 'Role', 'Total Sales', 'Transactions', 'Avg Transaction'];
      rows = staffPerformance.map(s => [
        s.name,
        s.role,
        s.totalSales.toString(),
        s.transactionCount.toString(),
        s.avgTransactionValue.toString()
      ]);
    } else if (reportType === 'attendance') {
      headers = ['Staff Name', 'Role', 'Present Days', 'Absent Days', 'Percentage'];
      rows = attendanceData.map(a => [
        a.name,
        a.role,
        a.present.toString(),
        a.absent.toString(),
        `${a.percentage}%`
      ]);
    } else if (reportType === 'payroll') {
      headers = ['Date', 'Employee', 'Amount', 'Method', 'Reference'];
      rows = payrollData.map(p => {
        const employee = employees.find(e => e.id === p.employeeId);
        return [
          format(new Date(p.paymentDate), 'yyyy-MM-dd'),
          employee?.name || 'Unknown',
          p.netSalary.toString(),
          p.method,
          p.reference || '-'
        ];
      });
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalRevenue = salesData.reduce((sum, s) => sum + s.total, 0);
  const totalTransactions = salesData.length;
  const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  const salesByCategory = useMemo(() => {
    const categories: Record<string, number> = {};
    salesData.forEach(sale => {
      sale.items.forEach(item => {
        const cat = item.category || 'Uncategorized';
        categories[cat] = (categories[cat] || 0) + (item.price * item.quantity);
      });
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [salesData]);

  const salesByPaymentMethod = useMemo(() => {
    const methods: Record<string, number> = {};
    salesData.forEach(sale => {
      methods[sale.paymentMethod] = (methods[sale.paymentMethod] || 0) + sale.total;
    });
    return Object.entries(methods).map(([name, value]) => ({ name, value }));
  }, [salesData]);

  const THEME_COLORS = [
    'var(--primary-color)',
    'var(--secondary-color)',
    'var(--accent-color)',
    '#f59e0b',
    '#ef4444',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899'
  ];

  const renderSalesSummary = () => {
    const startPrev = subDays(new Date(startDate), Math.max(1, differenceInDays(new Date(endDate), new Date(startDate)) + 1));
    const endPrev = subDays(new Date(endDate), Math.max(1, differenceInDays(new Date(endDate), new Date(startDate)) + 1));
    
    // We would ideally fetch previousSalesData here, but since this is inside a render function
    // and we don't have it in state, we'll just omit the fake trend for now to satisfy the user's "hardcoded" concern
    // Or we can calculate it if we had all sales.
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-accent/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-accent" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-1">Total Revenue</p>
            <h3 className="text-2xl font-bold">{formatCurrency(totalRevenue)}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-accent/10 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-accent" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-1">Total Transactions</p>
            <h3 className="text-2xl font-bold">{totalTransactions}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-secondary" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-1">Avg. Transaction</p>
            <h3 className="text-2xl font-bold">{formatCurrency(avgTransaction, { maximumFractionDigits: 0 })}</h3>
          </div>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
          <h3 className="font-bold mb-6 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-primary" />
            Sales by Category
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={salesByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {salesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={THEME_COLORS[index % THEME_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
          <h3 className="font-bold mb-6 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-secondary" />
            Payment Methods
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={salesByPaymentMethod}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {salesByPaymentMethod.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={THEME_COLORS[(index + 2) % THEME_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Total']}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-black/5">
          <h3 className="font-bold">Recent Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Transaction ID</th>
                <th className="px-6 py-4">Cashier</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Payment</th>
                <th className="px-6 py-4">Rec/Chg</th>
                <th className="px-6 py-4">Items</th>
                <th className="px-6 py-4 text-right">Total</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {salesData.map((sale) => {
                const isDebtPayment = sale.items.some(item => item.productId === 'DEBT_PAYMENT');
                return (
                  <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm">{format(new Date(sale.timestamp), 'MMM dd, HH:mm')}</td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-500">{sale.id.slice(0, 8)}</td>
                    <td className="px-6 py-4 text-sm">{sale.cashierName}</td>
                    <td className="px-6 py-4 text-sm italic text-gray-500">{sale.customerName || 'Walk-in'}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isDebtPayment ? 'bg-emerald-100 text-emerald-600' :
                        sale.paymentMethod === 'CASH' ? 'bg-primary/10 text-primary' :
                        sale.paymentMethod === 'MPESA' ? 'bg-accent/10 text-accent' :
                        'bg-secondary/10 text-secondary'
                      }`}>
                        {isDebtPayment ? 'PAID' : sale.paymentMethod}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {sale.paymentMethod === 'CASH' && sale.cashReceived !== undefined ? (
                        <div className="text-[10px] leading-tight">
                          <p className="text-gray-500">R: {formatCurrency(sale.cashReceived)}</p>
                          <p className="text-indigo-600 font-bold">C: {formatCurrency(sale.change || 0)}</p>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-[10px]">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {isDebtPayment ? (
                        <span className="font-bold text-emerald-600">Debt Payment</span>
                      ) : (
                        `${sale.items.length} items`
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-right">{formatCurrency(sale.total)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {
                            setSelectedSale(sale);
                            setShowReceipt(true);
                          }}
                          className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="View Receipt"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteSale(sale.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Transaction"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {salesData.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No transactions found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    );
  };

  const renderProfitLoss = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Total Revenue</p>
          <h3 className="text-2xl font-bold">{formatCurrency(profitData.totalRevenue)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Cost of Goods Sold</p>
          <h3 className="text-2xl font-bold text-red-600">{formatCurrency(profitData.totalCost)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Gross Profit</p>
          <h3 className="text-2xl font-bold text-accent">{formatCurrency(profitData.grossProfit)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Profit Margin</p>
          <h3 className="text-2xl font-bold">
            {profitData.totalRevenue > 0 
              ? ((profitData.grossProfit / profitData.totalRevenue) * 100).toFixed(1)
              : 0}%
          </h3>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm">
        <h3 className="text-lg font-bold mb-6">Profit & Loss Statement</h3>
        <div className="space-y-4 max-w-2xl">
          <div className="flex justify-between items-center py-2 border-b border-black/5">
            <span className="text-gray-600">Total Sales Revenue</span>
            <span className="font-bold">{formatCurrency(profitData.totalRevenue)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-black/5">
            <span className="text-gray-600">Cost of Goods Sold (COGS)</span>
            <span className="font-bold text-red-600">({formatCurrency(profitData.totalCost)})</span>
          </div>
          <div className="flex justify-between items-center py-4 bg-gray-50 px-4 rounded-xl">
            <span className="font-bold">Gross Profit</span>
            <span className="font-bold text-accent text-xl">{formatCurrency(profitData.grossProfit)}</span>
          </div>
          <div className="pt-8">
            <p className="text-xs text-gray-400 italic">
              * This is a simplified P&L statement based on direct sales and product costs.
              Operating expenses are not included in this view.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderInventoryReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-amber-900">Low Stock Alerts</h3>
          </div>
          <p className="text-sm text-amber-700">{lowStockProducts.length} products have variants below their minimum stock level.</p>
        </div>
        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => setReportType('inventoryValue')}>
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-blue-900">Inventory Value</h3>
          </div>
          <p className="text-sm text-blue-700">Click to view detailed inventory valuation report.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-black/5">
          <h3 className="font-bold">Low Stock Report</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Variant</th>
                <th className="px-6 py-4">Current Stock</th>
                <th className="px-6 py-4">Min Stock</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {lowStockProducts.flatMap((product) => 
                product.variants
                  .filter(v => v.stock <= (v.lowStockThreshold ?? product.lowStockThreshold))
                  .map((variant) => (
                    <tr key={`${product.id}-${variant.id}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium">{product.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{variant.size} / {variant.color}</td>
                      <td className="px-6 py-4 text-sm font-bold text-red-600">{variant.stock} {product.unit}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{variant.lowStockThreshold ?? product.lowStockThreshold} {product.unit}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {variant.stock === 0 ? 'Out of Stock' : 'Low Stock'}
                        </span>
                      </td>
                    </tr>
                  ))
              )}
              {lowStockProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-emerald-600 font-medium">
                    All products are well-stocked!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderInventoryValueReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Total Items in Stock</p>
          <h3 className="text-2xl font-bold">{(inventoryValueData.totalItems || 0).toLocaleString()}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Total Value (Buying)</p>
          <h3 className="text-2xl font-bold">{formatCurrency(inventoryValueData.totalBuyingValue)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Total Value (Selling)</p>
          <h3 className="text-2xl font-bold text-emerald-600">{formatCurrency(inventoryValueData.totalSellingValue)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Potential Profit</p>
          <h3 className="text-2xl font-bold text-blue-600">{formatCurrency(inventoryValueData.potentialProfit)}</h3>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-black/5">
          <h3 className="font-bold">Inventory Valuation Detail</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Buying Price</th>
                <th className="px-6 py-4">Selling Price</th>
                <th className="px-6 py-4 text-right">Total Buying Value</th>
                <th className="px-6 py-4 text-right">Total Selling Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {products.map((product) => {
                const stock = product.variants.reduce((sum, v) => sum + v.stock, 0);
                const buyingValue = stock * (product.buyingPrice || 0);
                const sellingValue = stock * (product.sellingPrice || product.basePrice);
                
                return (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium">{product.name}</div>
                      <div className="text-xs text-gray-400">{product.category}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">{stock} {product.unit}</td>
                    <td className="px-6 py-4 text-sm">{formatCurrency(product.buyingPrice || 0)}</td>
                    <td className="px-6 py-4 text-sm">{formatCurrency(product.sellingPrice || product.basePrice)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-right">{formatCurrency(buyingValue)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-right text-accent">{formatCurrency(sellingValue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderStaffPerformance = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staffPerformance.map((staff) => (
          <div key={staff.name} className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-lg">
                {staff.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold">{staff.name}</h3>
                <p className={`text-[10px] font-bold uppercase ${
                  staff.role === 'admin' ? 'text-indigo-600' : 'text-gray-500'
                }`}>{staff.role === 'admin' ? 'Admin' : 'Staff'}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Sales</span>
                <span className="font-bold">{formatCurrency(staff.totalSales)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Transactions</span>
                <span className="font-bold">{staff.transactionCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Avg. Transaction</span>
                <span className="font-bold">{formatCurrency(staff.avgTransactionValue, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>
        ))}
        {staffPerformance.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500">
            No staff performance data available for this period.
          </div>
        )}
      </div>
    </div>
  );

  const renderAttendanceReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {attendanceData.map((staff) => (
          <div key={staff.id} className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold text-lg">
                {staff.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold">{staff.name}</h3>
                <p className="text-[10px] font-bold uppercase text-gray-500">{staff.role}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Present Days</span>
                <span className="font-bold text-emerald-600">{staff.present}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Absent Days</span>
                <span className="font-bold text-rose-500">{staff.absent}</span>
              </div>
              <div className="pt-4 border-t border-black/5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-gray-400 uppercase">Attendance Rate</span>
                  <span className={`text-lg font-black ${staff.percentage >= 90 ? 'text-emerald-500' : staff.percentage >= 75 ? 'text-amber-500' : 'text-rose-500'}`}>
                    {staff.percentage}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${staff.percentage >= 90 ? 'bg-emerald-500' : staff.percentage >= 75 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${staff.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
        {attendanceData.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500">
            No attendance data found for this period.
          </div>
        )}
      </div>
    </div>
  );

  const renderPayrollReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Total Payroll</p>
          <h3 className="text-2xl font-bold">{formatCurrency(totalPayroll)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Payments Made</p>
          <h3 className="text-2xl font-bold">{payrollData.length}</h3>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-black/5">
          <h3 className="font-bold">Salary Payments List</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {payrollData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 italic">No payroll records found for this period.</td>
                </tr>
              ) : (
                payrollData.map((p) => {
                  const employee = employees.find(e => e.id === p.employeeId);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm">{format(new Date(p.paymentDate), 'MMM dd, yyyy')}</td>
                      <td className="px-6 py-4 text-sm font-bold">{employee?.name || 'Unknown'}</td>
                      <td className="px-6 py-4 text-sm font-bold text-indigo-600">{formatCurrency(p.netSalary)}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-full uppercase">
                          {p.method}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 font-mono">{p.reference || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Business Reports</h1>
          <p className="text-gray-500 mt-1">Analyze your business performance and inventory</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => handlePrintReport()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-black/10 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-black/90 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm mb-8 flex flex-wrap items-center gap-4 print:hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-black/5">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent border-none text-sm focus:ring-0 p-0"
          />
          <span className="text-gray-400">to</span>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent border-none text-sm focus:ring-0 p-0"
          />
        </div>

        <div className="h-8 w-px bg-black/5 hidden md:block" />

        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl print:hidden overflow-x-auto no-scrollbar">
          {[
            { id: 'sales', label: 'Sales', icon: BarChart3 },
            { id: 'profit', label: 'P&L', icon: TrendingUp },
            { id: 'inventory', label: 'Stock', icon: Package },
            { id: 'inventoryValue', label: 'Value', icon: DollarSign },
            { id: 'staff', label: 'Staff', icon: Users },
            { id: 'attendance', label: 'Attendance', icon: UserCheck },
            { id: 'payroll', label: 'Payroll', icon: Users },
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setReportType(type.id as ReportType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                reportType === type.id 
                  ? 'bg-white text-black shadow-sm' 
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              <type.icon className="w-4 h-4" />
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Report Content */}
      {/* Receipt Modal */}
      <AnimatePresence>
        {showReceipt && selectedSale && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-6 bg-indigo-600 text-white flex flex-col items-center gap-2 shrink-0">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold">Transaction Details</h3>
                <p className="text-white/80 text-xs">Transaction ID: {selectedSale.id.slice(-8).toUpperCase()}</p>
                <button 
                  onClick={() => setShowReceipt(false)}
                  className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 bg-bg/50">
                <div id="print-receipt" className="bg-white shadow-sm rounded-2xl overflow-hidden mb-6 mx-auto max-w-[420px]">
                  <Receipt sale={selectedSale} businessProfile={businessProfile} />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 no-print max-w-[420px] mx-auto">
                  <button 
                    onClick={handlePrintReceipt}
                    className="flex items-center justify-center gap-2 py-3 border border-border rounded-xl font-semibold text-ink hover:bg-bg transition-all text-sm"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  <button 
                    onClick={handleShareReceipt}
                    className="flex items-center justify-center gap-2 py-3 border border-border rounded-xl font-semibold text-ink hover:bg-bg transition-all text-sm"
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSaleToDelete(null);
        }}
        onConfirm={confirmDeleteSale}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
      />
      <div ref={reportRef} id="print-report-container" className="print:p-8">
        <div className="hidden print:block mb-8">
          <h1 className="text-2xl font-bold">{businessProfile?.name || 'Business'} - {reportType.toUpperCase()} Report</h1>
          <p className="text-gray-500">Period: {format(new Date(startDate), 'MMM dd, yyyy')} to {format(new Date(endDate), 'MMM dd, yyyy')}</p>
          {shop && <p className="text-gray-500">Shop: {shop.name}</p>}
          <hr className="mt-4 border-black/10" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={reportType}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {reportType === 'sales' && renderSalesSummary()}
            {reportType === 'profit' && renderProfitLoss()}
            {reportType === 'inventory' && renderInventoryReport()}
            {reportType === 'inventoryValue' && renderInventoryValueReport()}
            {reportType === 'staff' && renderStaffPerformance()}
            {reportType === 'attendance' && renderAttendanceReport()}
            {reportType === 'payroll' && renderPayrollReport()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
