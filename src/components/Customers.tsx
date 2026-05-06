import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Customer, UserProfile, Sale } from '../types';
import { 
  UserPlus, 
  Search, 
  Phone, 
  Mail, 
  Award, 
  History, 
  Edit2, 
  Trash2, 
  X, 
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Users,
  ShoppingBag,
  Calendar,
  DollarSign,
  BookOpen,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface CustomersProps {
  user: UserProfile;
  businessId: string;
  onViewLedger: (id: string) => void;
}

export const Customers: React.FC<CustomersProps> = ({ user, businessId, onViewLedger }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
  });

  useEffect(() => {
    const updateCustomers = async () => {
      const c = await db.getCustomers(businessId);
      setCustomers(c);
    };
    
    updateCustomers();
    
    const handleDataUpdate = (e: any) => {
      if (['dmi_pos_customers', 'dmi_pos_sales'].includes(e.detail?.key)) {
        updateCustomers();
      }
    };

    window.addEventListener('local-db-update', handleDataUpdate);
    window.addEventListener('storage-sync', handleDataUpdate);
    
    const interval = setInterval(updateCustomers, 30000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('local-db-update', handleDataUpdate);
      window.removeEventListener('storage-sync', handleDataUpdate);
    };
  }, [businessId]);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<Sale[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!selectedCustomer) return;
      setLoadingHistory(true);
      try {
        const sales = await db.getSales(businessId);
        const history = sales.filter(s => s.customerId === selectedCustomer.id);
        setPurchaseHistory(history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [selectedCustomer, businessId]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleDelete = async () => {
    if (customerToDelete) {
      await db.deleteCustomer(customerToDelete);
      const freshCustomers = await db.getCustomers(businessId);
      setCustomers(freshCustomers);
      if (selectedCustomer?.id === customerToDelete) setSelectedCustomer(null);
      showSuccess('Customer deleted');
      setIsDeleteConfirmOpen(false);
      setCustomerToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await db.updateCustomer(editingCustomer.id, formData);
        showSuccess('Customer updated successfully');
      } else {
        await db.addCustomer({
          ...formData,
          businessId,
          loyaltyPoints: 0,
          totalSpent: 0,
          createdAt: new Date().toISOString()
        });
        showSuccess('Customer added successfully');
      }
      const freshCustomers = await db.getCustomers(businessId);
      setCustomers(freshCustomers);
      setIsModalOpen(false);
      setEditingCustomer(null);
      setFormData({ name: '', phone: '' });
    } catch (error) {
      console.error("Customer error:", error);
    }
  };

  const handleDownloadCSV = () => {
    const headers = ['Name', 'Phone', 'Email', 'Loyalty Points', 'Total Spent', 'Last Purchase'];
    const rows = customers.map(c => [
      c.name,
      c.phone,
      c.email || '',
      c.loyaltyPoints.toString(),
      c.totalSpent.toString(),
      c.lastPurchaseDate || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `customers_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    c.phone.includes(searchTerm)
  );

  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
  const avgSpent = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
  const topCustomer = customers.length > 0 ? [...customers].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))[0] : null;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-600">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-muted uppercase">Total Customers</span>
          </div>
          <p className="text-3xl font-bold text-ink">{totalCustomers}</p>
        </div>

        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-muted uppercase">Avg. Life. Value</span>
          </div>
          <p className="text-3xl font-bold text-ink">KSh{avgSpent.toLocaleString()}</p>
        </div>

        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-600">
              <Award className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-muted uppercase">Top Customer</span>
          </div>
          <p className="text-base font-bold text-ink truncate" title={topCustomer?.name || 'N/A'}>
            {topCustomer?.name || 'N/A'}
          </p>
          <p className="text-sm text-muted">Spent KSh{(topCustomer?.totalSpent || 0).toLocaleString()}</p>
        </div>

        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-600">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-muted uppercase">New This Month</span>
          </div>
          <p className="text-3xl font-bold text-ink">
            {customers.filter(c => {
              const date = c.createdAt ? new Date(c.createdAt) : new Date();
              return date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear();
            }).length}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 right-8 z-[110] bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-bold">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
          <input
            type="text"
            placeholder="Search customers by name, email or phone..."
            className="w-full pl-10 pr-4 py-2 bg-card border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-6 py-2 bg-card border border-border text-ink rounded-xl font-bold hover:bg-muted transition-all shadow-sm"
          >
            <Download className="w-5 h-5" />
            Download CSV
          </button>
          <button
            onClick={() => {
              setEditingCustomer(null);
              setFormData({ name: '', phone: '' });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
          >
            <UserPlus className="w-5 h-5" />
            Add Customer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredCustomers.length === 0 ? (
          <div className="md:col-span-2 xl:col-span-3 bg-card border border-border rounded-3xl p-20 flex flex-col items-center justify-center text-muted gap-4 shadow-sm">
            <div className="w-24 h-24 bg-bg rounded-full flex items-center justify-center">
              <Users className="w-12 h-12 opacity-20" />
            </div>
            <div className="text-center max-w-xs">
              <p className="text-xl font-bold text-ink mb-2">No customers found</p>
              <p className="text-sm text-muted">
                {searchTerm 
                  ? "We couldn't find any customers matching your search." 
                  : "Your customer list is empty. Start by adding your first customer."}
              </p>
            </div>
            {!searchTerm && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
              >
                Add First Customer
              </button>
            )}
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={customer.id}
              className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group cursor-pointer"
              onClick={() => setSelectedCustomer(customer)}
            >
              <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-indigo-500/10 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <span className="text-xl font-bold">{customer.name.charAt(0)}</span>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingCustomer(customer);
                    setFormData({
                      name: customer.name,
                      phone: customer.phone
                    });
                    setIsModalOpen(true);
                  }}
                  className="p-2 text-muted hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {user.role === 'admin' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCustomerToDelete(customer.id);
                      setIsDeleteConfirmOpen(true);
                    }}
                    className="p-2 text-muted hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-900/30 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewLedger(customer.id);
                  }}
                  className="p-2 text-muted hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 dark:hover:bg-emerald-900/30 rounded-lg transition-all"
                  title="View Ledger"
                >
                  <BookOpen className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h3 className="text-lg font-bold text-ink mb-1">{customer.name}</h3>
            
            <div className="space-y-2 mb-6">
              {customer.email && (
                <a 
                  href={`mailto:${customer.email}`}
                  className="flex items-center gap-2 text-sm text-muted hover:text-indigo-500 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Mail className="w-4 h-4 text-indigo-500" />
                  <span>{customer.email}</span>
                </a>
              )}
              <a 
                href={`tel:${customer.phone}`}
                className="flex items-center gap-2 text-sm text-muted hover:text-indigo-500 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="w-4 h-4 text-indigo-500" />
                <span>{customer.phone}</span>
              </a>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div>
                <p className="text-[10px] font-bold text-muted uppercase mb-1">Loyalty Points</p>
                <div className="flex items-center gap-1 text-indigo-600 font-bold">
                  <Award className="w-4 h-4" />
                  <span>{customer.loyaltyPoints}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted uppercase mb-1">Total Spent</p>
                <div className="flex items-center gap-1 text-emerald-600 font-bold">
                  <TrendingUp className="w-4 h-4" />
                  <span>${customer.totalSpent.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {customer.lastPurchaseDate && (
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-[10px] text-muted">
                <div className="flex items-center gap-1">
                  <History className="w-3 h-3" />
                  <span>Last Purchase</span>
                </div>
                <span>{format(new Date(customer.lastPurchaseDate), 'MMM dd, yyyy')}</span>
              </div>
            )}
          </motion.div>
        )))}
      </div>

      {/* Purchase History Modal */}
      <AnimatePresence>
        {selectedCustomer && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCustomer(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-card rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-border"
            >
              <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-500/10 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <History className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-ink">Purchase History</h3>
                    <p className="text-sm text-muted">{selectedCustomer.name}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-muted rounded-xl transition-all">
                  <X className="w-6 h-6 text-muted" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                  </div>
                ) : purchaseHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted gap-4">
                    <ShoppingBag className="w-12 h-12 opacity-20" />
                    <p className="text-sm font-bold">No purchases found for this customer</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {purchaseHistory.map((sale) => (
                      <div key={sale.id} className="p-4 rounded-2xl border border-border hover:border-indigo-500/30 transition-all bg-bg/50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-card rounded-lg border border-border">
                              <Calendar className="w-4 h-4 text-muted" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-ink">
                                {format(new Date(sale.timestamp), 'MMM dd, yyyy')}
                              </p>
                              <p className="text-[10px] text-muted uppercase font-bold">
                                {format(new Date(sale.timestamp), 'HH:mm')} • ID: {sale.id.slice(-6).toUpperCase()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-emerald-600 flex items-center justify-end gap-1">
                              <DollarSign className="w-4 h-4" />
                              {sale.total.toFixed(2)}
                            </p>
                            <p className="text-[10px] text-muted font-bold">
                              {sale.items.reduce((sum, i) => sum + i.quantity, 0)} items
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {sale.items.map((item, idx) => (
                            <span key={idx} className="px-2 py-1 bg-card border border-border rounded-lg text-[10px] text-muted">
                              {item.quantity}x {item.name} ({item.variantName})
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border"
            >
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h3 className="text-xl font-bold text-ink">
                  {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-bg rounded-xl transition-all">
                  <X className="w-6 h-6 text-muted" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-ink mb-1">Full Name</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-ink mb-1">Phone Number</label>
                  <input
                    required
                    type="tel"
                    className="w-full px-4 py-2 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-border text-muted font-bold rounded-xl hover:bg-bg transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                  >
                    {editingCustomer ? 'Save Changes' : 'Add Customer'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setCustomerToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Delete Customer?"
        message="Are you sure you want to delete this customer? This will remove all their purchase history and loyalty points."
        itemName={customers.find(c => c.id === customerToDelete)?.name}
      />
    </div>
  );
};
