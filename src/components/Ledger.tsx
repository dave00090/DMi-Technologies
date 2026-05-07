import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { LedgerEntry, Customer, Supplier, BusinessProfile, UserProfile } from '../types';
import { 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  User, 
  Truck,
  Filter,
  Download,
  DollarSign,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { Debt } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface LedgerProps {
  businessId: string;
  user: UserProfile;
  initialSelection?: { id: string, type: 'CUSTOMER' | 'SUPPLIER' } | null;
  onClearSelection?: () => void;
}

export const Ledger: React.FC<LedgerProps> = ({ businessId, user, initialSelection, onClearSelection }) => {
  const [activeTab, setActiveTab] = useState<'CUSTOMER' | 'SUPPLIER'>(initialSelection?.type || 'CUSTOMER');
  const [entities, setEntities] = useState<(Customer | Supplier)[]>([]);
  const [allActiveDebts, setAllActiveDebts] = useState<Debt[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Customer | Supplier | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [activeDebts, setActiveDebts] = useState<Debt[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchLedger = async () => {
    if (selectedEntity) {
      const entries = await db.getLedger(selectedEntity.id, activeTab);
      setLedgerEntries(entries);
      if (activeTab === 'CUSTOMER') {
        const debts = await db.getDebts(selectedEntity.id);
        setActiveDebts(debts.filter(d => d.status === 'PENDING' || d.status === 'PARTIAL'));
      }
    }
    // Update all debts if in customer tab to keep list updated
    if (activeTab === 'CUSTOMER') {
      const allD = await db.getAllDebts(businessId);
      setAllActiveDebts(allD.filter(d => d.status === 'PENDING' || d.status === 'PARTIAL'));
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const [currentEntities, profile, allD] = await Promise.all([
        activeTab === 'CUSTOMER' ? db.getCustomers(businessId) : db.getSuppliers(businessId),
        db.getBusinessById(businessId),
        activeTab === 'CUSTOMER' ? db.getAllDebts(businessId) : Promise.resolve([])
      ]);
      
      setEntities(currentEntities);
      setBusinessProfile(profile);
      setAllActiveDebts((allD as Debt[]).filter(d => d.status === 'PENDING' || d.status === 'PARTIAL'));

      if (initialSelection && initialSelection.type === activeTab) {
        const entity = currentEntities.find(e => e.id === initialSelection.id);
        if (entity) {
          setSelectedEntity(entity);
        }
        onClearSelection?.();
      } else if (!initialSelection) {
        setSelectedEntity(null);
        setLedgerEntries([]);
        setActiveDebts([]);
      }
    };
    fetchData();
  }, [activeTab, businessId, initialSelection]);

  useEffect(() => {
    fetchLedger();
  }, [selectedEntity, activeTab]);

  const handlePayDebt = async (debtId: string, amount: number) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await db.payDebt(debtId, amount, user.uid, user.name);
      setSuccessMessage("DEBT PAID!");
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchLedger();
    } catch (error) {
      console.error("Error paying debt:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayAllDebtsForCustomer = async (customerId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const customerDebts = allActiveDebts.filter(d => d.customerId === customerId);
      for (const debt of customerDebts) {
        await db.payDebt(debt.id, debt.remainingAmount, user.uid, user.name);
      }
      setSuccessMessage("DEBTS CLEARED!");
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Refresh everything
      const [currentEntities, allD] = await Promise.all([
        activeTab === 'CUSTOMER' ? db.getCustomers(businessId) : db.getSuppliers(businessId),
        db.getAllDebts(businessId)
      ]);
      setEntities(currentEntities);
      setAllActiveDebts(allD.filter(d => d.status === 'PENDING' || d.status === 'PARTIAL'));
      
      if (selectedEntity) {
        await fetchLedger();
      }
    } catch (error) {
      console.error("Error paying debts:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredEntities = entities.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.phone.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number | undefined | null) => {
    const currency = businessProfile?.currency || 'KSh';
    if (amount === undefined || amount === null) return `${currency}0`;
    return `${currency}${amount.toLocaleString()}`;
  };

  const handleDownloadCSV = () => {
    if (!selectedEntity) return;
    const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
    const rows = ledgerEntries.map(e => [
      format(new Date(e.timestamp), 'yyyy-MM-dd HH:mm'),
      e.description,
      e.type === 'DEBIT' ? e.amount.toString() : '0',
      e.type === 'CREDIT' ? e.amount.toString() : '0',
      e.balanceAfter.toString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ledger_${selectedEntity.name}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-ink">Financial Ledger</h2>
          <p className="text-sm text-muted">Track accounts for debtors (customers) and creditors (suppliers)</p>
        </div>
        <div className="flex bg-card p-1.5 rounded-2xl border border-border shadow-sm">
          <button
            onClick={() => setActiveTab('CUSTOMER')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'CUSTOMER' ? 'bg-indigo-600 text-white shadow-lg' : 'text-muted hover:bg-bg'
            }`}
          >
            Customers (Debtors)
          </button>
          <button
            onClick={() => setActiveTab('SUPPLIER')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'SUPPLIER' ? 'bg-indigo-600 text-white shadow-lg' : 'text-muted hover:bg-bg'
            }`}
          >
            Suppliers (Creditors)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Entity List */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-280px)]">
            <div className="p-6 border-b border-border">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-5 h-5" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab.toLowerCase()}s...`}
                  className="w-full pl-12 pr-4 py-3 bg-bg border border-border text-ink rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredEntities.map((entity) => {
                const customerDebts = allActiveDebts.filter(d => d.customerId === entity.id);
                const totalDebtAmount = customerDebts.reduce((sum, d) => sum + d.remainingAmount, 0);

                const displayBalance = activeTab === 'CUSTOMER' 
                  ? totalDebtAmount
                  : (entity as Supplier).balance;

                return (
                  <div
                    key={entity.id}
                    onClick={() => setSelectedEntity(entity)}
                    className={`group relative w-full p-4 rounded-2xl border transition-all text-left flex flex-col gap-3 cursor-pointer ${
                      selectedEntity?.id === entity.id
                        ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-500/20'
                        : 'bg-card border-border hover:border-indigo-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                          selectedEntity?.id === entity.id ? 'bg-white/20 text-white' : 'bg-bg text-muted group-hover:bg-indigo-500/10'
                        }`}>
                          {activeTab === 'CUSTOMER' ? <User className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className={`font-bold truncate max-w-[120px] ${selectedEntity?.id === entity.id ? 'text-white' : 'text-ink'}`}>
                            {entity.name}
                          </p>
                          <p className={`text-[10px] uppercase font-bold ${selectedEntity?.id === entity.id ? 'text-white/60' : 'text-muted'}`}>
                            {entity.phone}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <p className={`text-[10px] font-bold uppercase opacity-60 mb-0.5 ${selectedEntity?.id === entity.id ? 'text-white' : 'text-muted'}`}>
                          Balance
                        </p>
                        <div className="flex items-center gap-2">
                          <p className={`font-bold ${
                            selectedEntity?.id === entity.id 
                              ? 'text-white' 
                              : activeTab === 'CUSTOMER' && totalDebtAmount > 0 
                                ? 'text-rose-500' 
                                : 'text-ink'
                          }`}>
                            {formatCurrency(displayBalance)}
                          </p>
                          {activeTab === 'CUSTOMER' && totalDebtAmount > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePayAllDebtsForCustomer(entity.id);
                              }}
                              disabled={isProcessing}
                              className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                                selectedEntity?.id === entity.id
                                  ? 'bg-white text-indigo-600 hover:bg-opacity-90'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
                              } disabled:opacity-50`}
                            >
                              {isProcessing ? '...' : 'Paid'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredEntities.length === 0 && (
                <div className="py-12 text-center text-muted flex flex-col items-center gap-3">
                  <History className="w-10 h-10 opacity-20" />
                  <p className="text-sm">No {activeTab.toLowerCase()}s found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ledger Detail */}
        <div className="lg:col-span-8 space-y-6">
          {selectedEntity ? (
            <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-280px)] relative">
              <AnimatePresence>
                {successMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-bold">{successMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold text-2xl shadow-lg">
                    {selectedEntity.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-ink">{selectedEntity.name}</h3>
                    <p className="text-sm text-muted font-bold uppercase tracking-widest">{activeTab} Ledger Account</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleDownloadCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Statement
                  </button>
                  <button className="p-2 bg-bg border border-border text-muted rounded-xl hover:bg-muted transition-all">
                    <Filter className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 border-b border-border">
                <div className="p-6 border-r border-border">
                  <p className="text-[10px] font-bold text-muted uppercase mb-1">Total Transactions</p>
                  <p className="text-2xl font-bold text-ink">{ledgerEntries.length}</p>
                </div>
                <div className="p-6 border-r border-border">
                  <p className="text-[10px] font-bold text-muted uppercase mb-1">Total Debits</p>
                  <p className="text-2xl font-bold text-rose-500">
                    {formatCurrency(ledgerEntries.filter(e => e.type === 'DEBIT').reduce((sum, e) => sum + e.amount, 0))}
                  </p>
                </div>
                <div className="p-6">
                  <p className="text-[10px] font-bold text-muted uppercase mb-1">Total Credits</p>
                  <p className="text-2xl font-bold text-emerald-500">
                    {formatCurrency(ledgerEntries.filter(e => e.type === 'CREDIT').reduce((sum, e) => sum + e.amount, 0))}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {activeTab === 'CUSTOMER' && activeDebts.length > 0 && (
                  <div className="p-6 border-b border-border bg-rose-500/5">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertCircle className="w-5 h-5 text-rose-500" />
                      <h4 className="text-sm font-bold text-ink uppercase tracking-wider">Unpaid Debts</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeDebts.map((debt) => (
                        <div key={debt.id} className="bg-card p-4 rounded-2xl border border-rose-500/20 flex items-center justify-between shadow-sm">
                          <div>
                            <p className="text-[10px] font-bold text-muted uppercase">Amount Due</p>
                            <p className="text-lg font-black text-rose-500">{formatCurrency(debt.remainingAmount)}</p>
                            <p className="text-[10px] text-muted font-bold mt-1">Sale #{debt.saleId.slice(-8).toUpperCase()}</p>
                          </div>
                          <button
                            onClick={() => handlePayDebt(debt.id, debt.remainingAmount)}
                            disabled={isProcessing}
                            className="px-6 py-2 bg-emerald-600 text-white text-xs font-black rounded-xl shadow-lg hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                          >
                            {isProcessing ? 'PROCESSING...' : 'MARK AS PAID'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="bg-bg/50">
                      <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Date</th>
                      <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Description</th>
                      <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Debit</th>
                      <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Credit</th>
                      <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ledgerEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-bg/30 transition-colors">
                        <td className="p-4 text-sm text-ink font-medium">
                          {format(new Date(entry.timestamp), 'MMM dd, HH:mm')}
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-ink font-medium">{entry.description}</p>
                          {entry.referenceId && (
                            <p className="text-[10px] text-muted font-mono">REF: {entry.referenceId.slice(-8).toUpperCase()}</p>
                          )}
                        </td>
                        <td className="p-4 text-sm font-bold text-rose-500 text-right">
                          {entry.type === 'DEBIT' ? formatCurrency(entry.amount) : '-'}
                        </td>
                        <td className="p-4 text-sm font-bold text-emerald-500 text-right">
                          {entry.type === 'CREDIT' ? formatCurrency(entry.amount) : '-'}
                        </td>
                        <td className="p-4 text-sm font-bold text-ink text-right">
                          {formatCurrency(entry.balanceAfter)}
                        </td>
                      </tr>
                    ))}
                    {ledgerEntries.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-muted">
                          <div className="flex flex-col items-center gap-3">
                            <History className="w-10 h-10 opacity-20" />
                            <p>No ledger entries found for this {activeTab.toLowerCase()}.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-3xl shadow-sm h-[calc(100vh-280px)] flex flex-col items-center justify-center gap-4 text-center p-12">
              <div className="w-20 h-20 bg-bg rounded-full flex items-center justify-center">
                <History className="w-10 h-10 text-muted opacity-20" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-ink">Select an Account</h3>
                <p className="text-sm text-muted max-w-xs">Select a customer or supplier from the list to view their detailed ledger and transaction history.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
