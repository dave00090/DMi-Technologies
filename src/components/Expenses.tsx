import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Expense, BusinessProfile, UserProfile, PaymentMethod } from '../types';
import { 
  Plus, 
  Search, 
  Trash2, 
  DollarSign, 
  Calendar, 
  Tag, 
  CreditCard,
  Filter,
  Download,
  PieChart as PieChartIcon,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface ExpensesProps {
  businessId: string;
  shopId: string;
  user: UserProfile;
}

export const Expenses: React.FC<ExpensesProps> = ({ businessId, shopId, user }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  
  const [formData, setFormData] = useState<Omit<Expense, 'id'>>({
    businessId,
    shopId,
    category: '',
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH',
    recordedBy: user.name
  });

  useEffect(() => {
    const fetchData = async () => {
      const [exp, profile] = await Promise.all([
        db.getExpenses(businessId, shopId),
        db.getBusinessById(businessId)
      ]);
      setExpenses(exp);
      setBusinessProfile(profile);
    };
    fetchData();

    const handleDataUpdate = (e: any) => {
      if (['dmi_pos_expenses', 'dmi_pos_businesses'].includes(e.detail?.key)) {
        fetchData();
      }
    };

    window.addEventListener('local-db-update', handleDataUpdate);
    window.addEventListener('storage-sync', handleDataUpdate);

    return () => {
      window.removeEventListener('local-db-update', handleDataUpdate);
      window.removeEventListener('storage-sync', handleDataUpdate);
    };
  }, [businessId, shopId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.addExpense(formData);
    const freshExpenses = await db.getExpenses(businessId, shopId);
    setExpenses(freshExpenses);
    setIsModalOpen(false);
    setFormData({
      businessId,
      shopId,
      category: '',
      amount: 0,
      description: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'CASH',
      recordedBy: user.name
    });
  };

  const handleDelete = (id: string) => {
    setExpenseToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (expenseToDelete) {
      await db.deleteExpense(expenseToDelete);
      const freshExpenses = await db.getExpenses(businessId, shopId);
      setExpenses(freshExpenses);
      setIsDeleteModalOpen(false);
      setExpenseToDelete(null);
    }
  };

  const handleDownloadCSV = () => {
    const headers = ['Date', 'Category', 'Description', 'Method', 'Amount', 'Recorded By'];
    const rows = filteredExpenses.map(e => [
      format(new Date(e.date), 'yyyy-MM-dd'),
      e.category,
      e.description,
      e.paymentMethod,
      e.amount.toString(),
      e.recordedBy
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `expenses_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredExpenses = expenses.filter(e => 
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const expensesByCategory = React.useMemo(() => {
    const categories: Record<string, number> = {};
    filteredExpenses.forEach(exp => {
      categories[exp.category] = (categories[exp.category] || 0) + exp.amount;
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [filteredExpenses]);

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

  const formatCurrency = (amount: number | undefined | null) => {
    const currency = businessProfile?.currency || 'KSh';
    if (amount === undefined || amount === null) return `${currency}0`;
    return `${currency}${amount.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-ink">Expense Management</h2>
          <p className="text-sm text-muted">Track and manage your business spending</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Expense
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500">
              <DollarSign className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-muted uppercase">Total Expenses</span>
          </div>
          <p className="text-3xl font-bold text-ink">{formatCurrency(totalExpenses)}</p>
        </div>
        
        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
              <Tag className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-muted uppercase">Categories</span>
          </div>
          <p className="text-3xl font-bold text-ink">{new Set(expenses.map(e => e.category)).size}</p>
        </div>

        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
              <Calendar className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-muted uppercase">This Month</span>
          </div>
          <p className="text-3xl font-bold text-ink">
            {formatCurrency(expenses
              .filter(e => new Date(e.date).getMonth() === new Date().getMonth())
              .reduce((sum, e) => sum + e.amount, 0))}
          </p>
        </div>
      </div>

      {expensesByCategory.length > 0 && (
        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
          <h3 className="text-lg font-bold text-ink mb-6 flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-primary" />
            Expense Distribution by Category
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expensesByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {expensesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={THEME_COLORS[index % THEME_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Amount']}
                  contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', borderRadius: '1rem' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-5 h-5" />
            <input
              type="text"
              placeholder="Search expenses..."
              className="w-full pl-12 pr-4 py-3 bg-bg border border-border text-ink rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="p-3 bg-bg border border-border text-muted rounded-2xl hover:bg-muted transition-all">
              <Filter className="w-5 h-5" />
            </button>
            <button 
              onClick={handleDownloadCSV}
              className="p-3 bg-bg border border-border text-muted rounded-2xl hover:bg-muted transition-all"
              title="Download CSV"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg/50">
                <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Date</th>
                <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Category</th>
                <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Description</th>
                <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Method</th>
                <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Amount</th>
                <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-bg/30 transition-colors">
                  <td className="p-4 text-sm text-ink font-medium">
                    {format(new Date(expense.date), 'MMM dd, yyyy')}
                  </td>
                  <td className="p-4">
                    <span className="px-3 py-1 bg-indigo-500/10 text-indigo-500 text-[10px] font-bold rounded-full uppercase">
                      {expense.category}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted max-w-xs truncate">
                    {expense.description}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <CreditCard className="w-3 h-3" />
                      {expense.paymentMethod}
                    </div>
                  </td>
                  <td className="p-4 text-sm font-bold text-ink text-right">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted">
                    No expenses found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setExpenseToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
        itemName={expenses.find(e => e.id === expenseToDelete)?.description}
      />

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-xl font-bold text-ink">Add New Expense</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-ink">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted uppercase">Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted uppercase">Category</label>
                  <select
                    required
                    className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="">Select Category</option>
                    <option value="Rent">Rent</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Salaries">Salaries</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Transport">Transport</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase">Amount ({businessProfile?.currency || 'KSh'})</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase">Payment Method</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['CASH', 'MPESA', 'CARD'] as PaymentMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setFormData({ ...formData, paymentMethod: method })}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        formData.paymentMethod === method
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                          : 'bg-bg border-border text-muted hover:border-indigo-500'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase">Description</label>
                <textarea
                  required
                  className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-h-[100px]"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What was this expense for?"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 transition-all"
              >
                Save Expense
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
