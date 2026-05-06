import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Supplier, BusinessProfile, UserProfile } from '../types';
import { 
  Plus, 
  Search, 
  Trash2, 
  Truck, 
  Phone, 
  Mail, 
  MapPin,
  User,
  ExternalLink,
  DollarSign,
  History,
  Download,
  Filter,
  X,
  Edit2,
  BookOpen
} from 'lucide-react';
import { format } from 'date-fns';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface SuppliersProps {
  businessId: string;
  user: UserProfile;
  onViewLedger: (id: string) => void;
}

export const Suppliers: React.FC<SuppliersProps> = ({ businessId, user, onViewLedger }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCreditors, setFilterCreditors] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [newProduct, setNewProduct] = useState('');
  
  const [formData, setFormData] = useState<Omit<Supplier, 'id'>>({
    businessId,
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    category: '',
    totalSupplied: 0,
    totalPaid: 0,
    balance: 0,
    suppliedProducts: [],
    createdAt: new Date().toISOString()
  });

  useEffect(() => {
    const fetchData = async () => {
      const [supps, profile] = await Promise.all([
        db.getSuppliers(businessId),
        db.getBusinessById(businessId)
      ]);
      setSuppliers(supps);
      setBusinessProfile(profile);
    };
    fetchData();

    const handleDataUpdate = (e: any) => {
      if (['dmi_pos_suppliers', 'dmi_pos_businesses'].includes(e.detail?.key)) {
        fetchData();
      }
    };

    window.addEventListener('local-db-update', handleDataUpdate);
    window.addEventListener('storage-sync', handleDataUpdate);

    return () => {
      window.removeEventListener('local-db-update', handleDataUpdate);
      window.removeEventListener('storage-sync', handleDataUpdate);
    };
  }, [businessId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSupplier) {
      await db.updateSupplier(editingSupplier.id, formData);
    } else {
      await db.addSupplier(formData);
    }
    const freshSuppliers = await db.getSuppliers(businessId);
    setSuppliers(freshSuppliers);
    setIsModalOpen(false);
    setEditingSupplier(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      businessId,
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      category: '',
      totalSupplied: 0,
      totalPaid: 0,
      balance: 0,
      suppliedProducts: [],
      createdAt: new Date().toISOString()
    });
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      businessId: supplier.businessId,
      name: supplier.name,
      contactPerson: supplier.contactPerson || '',
      email: supplier.email || '',
      phone: supplier.phone,
      address: supplier.address || '',
      category: supplier.category || '',
      totalSupplied: supplier.totalSupplied,
      totalPaid: supplier.totalPaid,
      balance: supplier.balance,
      suppliedProducts: supplier.suppliedProducts || [],
      createdAt: supplier.createdAt
    });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (supplierToDelete) {
      await db.deleteSupplier(supplierToDelete);
      const freshSuppliers = await db.getSuppliers(businessId);
      setSuppliers(freshSuppliers);
      setIsDeleteConfirmOpen(false);
      setSupplierToDelete(null);
    }
  };

  const addProduct = () => {
    if (newProduct.trim()) {
      setFormData({
        ...formData,
        suppliedProducts: [...(formData.suppliedProducts || []), newProduct.trim()]
      });
      setNewProduct('');
    }
  };

  const removeProduct = (index: number) => {
    const updated = [...(formData.suppliedProducts || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, suppliedProducts: updated });
  };

  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.suppliedProducts?.some(p => p.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filterCreditors) {
      return matchesSearch && s.balance > 0;
    }
    return matchesSearch;
  });

  const handleDownloadCSV = () => {
    const headers = ['Name', 'Contact Person', 'Category', 'Phone', 'Email', 'Address', 'Total Supplied', 'Balance Owed', 'Products'];
    const rows = filteredSuppliers.map(s => [
      s.name,
      s.contactPerson || '',
      s.category || '',
      s.phone,
      s.email || '',
      s.address || '',
      s.totalSupplied.toString(),
      s.balance.toString(),
      (s.suppliedProducts || []).join('; ')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `suppliers_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (amount: number | undefined | null) => {
    const currency = businessProfile?.currency || 'KSh';
    if (amount === undefined || amount === null) return `${currency}0`;
    return `${currency}${amount.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-ink">Suppliers & Vendors</h2>
          <p className="text-sm text-muted">Manage your supply chain and vendor accounts</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFilterCreditors(!filterCreditors)}
            className={`flex items-center gap-2 px-6 py-3 border font-bold rounded-2xl transition-all shadow-sm ${
              filterCreditors 
                ? 'bg-rose-500 border-rose-500 text-white' 
                : 'bg-white border-border text-ink hover:bg-muted'
            }`}
          >
            <Filter className="w-5 h-5" />
            {filterCreditors ? 'Showing Creditors' : 'Filter Creditors'}
          </button>
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-border text-ink font-bold rounded-2xl shadow-sm hover:bg-muted transition-all"
          >
            <Download className="w-5 h-5" />
            Download CSV
          </button>
          <button
            onClick={() => {
              setEditingSupplier(null);
              resetForm();
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Supplier
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500">
              <Truck className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-muted uppercase">Total Suppliers</span>
          </div>
          <p className="text-3xl font-bold text-ink">{suppliers.length}</p>
        </div>
        
        <button 
          onClick={() => setFilterCreditors(!filterCreditors)}
          className={`bg-card p-6 rounded-3xl border shadow-sm text-left transition-all ${filterCreditors ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-border'}`}
        >
          <div className="flex items-center gap-4 mb-2">
            <div className={`p-3 rounded-2xl ${filterCreditors ? 'bg-rose-500 text-white' : 'bg-rose-500/10 text-rose-500'}`}>
              <DollarSign className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-muted uppercase">Total Balance Owed</span>
          </div>
          <p className="text-3xl font-bold text-rose-500">
            {formatCurrency(suppliers.reduce((sum, s) => sum + s.balance, 0))}
          </p>
          {filterCreditors && (
            <p className="text-[10px] text-rose-500 font-bold mt-2 uppercase">Filtering Creditors Only</p>
          )}
        </button>

        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
              <History className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-muted uppercase">Total Supplied</span>
          </div>
          <p className="text-3xl font-bold text-ink">
            {formatCurrency(suppliers.reduce((sum, s) => sum + s.totalSupplied, 0))}
          </p>
        </div>

        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-violet-500/10 rounded-2xl text-violet-500">
              <History className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-muted uppercase">Creditors</span>
          </div>
          <p className="text-3xl font-bold text-ink">
            {suppliers.filter(s => s.balance > 0).length}
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-5 h-5" />
            <input
              type="text"
              placeholder="Search suppliers by name, contact or category..."
              className="w-full pl-12 pr-4 py-3 bg-bg border border-border text-ink rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          {filteredSuppliers.map((supplier) => (
            <div key={supplier.id} className="bg-bg/50 border border-border rounded-3xl p-6 hover:shadow-lg transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg">
                  {supplier.name.charAt(0)}
                </div>
                <div className="flex flex-col items-end">
                  <span className="px-2 py-1 bg-indigo-500/10 text-indigo-500 text-[10px] font-bold rounded-lg uppercase">
                    {supplier.category || 'General'}
                  </span>
                  <p className="text-[10px] text-muted mt-1 font-bold">Since {format(new Date(supplier.createdAt), 'MMM yyyy')}</p>
                </div>
              </div>

              <h3 className="text-lg font-bold text-ink mb-1">{supplier.name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted mb-4">
                <User className="w-3 h-3" />
                {supplier.contactPerson || 'No contact person'}
              </div>

            <div className="space-y-2 mb-4">
              <a 
                href={`tel:${supplier.phone}`}
                className="flex items-center gap-3 text-sm text-muted hover:text-indigo-500 transition-colors"
              >
                <Phone className="w-4 h-4 text-indigo-500" />
                {supplier.phone}
              </a>
              {supplier.email && (
                <a 
                  href={`mailto:${supplier.email}`}
                  className="flex items-center gap-3 text-sm text-muted hover:text-indigo-500 transition-colors"
                >
                  <Mail className="w-4 h-4 text-indigo-500" />
                  {supplier.email}
                </a>
              )}
            </div>

              {supplier.suppliedProducts && supplier.suppliedProducts.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-bold text-muted uppercase mb-2">Supplied Products</p>
                  <div className="flex flex-wrap gap-1">
                    {supplier.suppliedProducts.map((p, i) => (
                      <span key={i} className="px-2 py-0.5 bg-bg border border-border text-[10px] text-ink rounded-md">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 p-4 bg-card rounded-2xl border border-border mb-6">
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase mb-1">Total Supplied</p>
                  <p className="text-sm font-bold text-ink">{formatCurrency(supplier.totalSupplied)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase mb-1">Balance Owed</p>
                  <p className={`text-sm font-bold ${supplier.balance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {formatCurrency(supplier.balance)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => onViewLedger(supplier.id)}
                  className="flex-1 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  <BookOpen className="w-3 h-3" />
                  Ledger
                </button>
                <button 
                  onClick={() => handleEdit(supplier)}
                  className="p-2 bg-bg border border-border text-indigo-600 rounded-xl hover:bg-indigo-500/10 transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    setSupplierToDelete(supplier.id);
                    setIsDeleteConfirmOpen(true);
                  }}
                  className="p-2 bg-bg border border-border text-rose-500 rounded-xl hover:bg-rose-500/10 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {filteredSuppliers.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted">
              No suppliers found matching your search.
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-3xl w-full max-w-2xl shadow-2xl my-8">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <h3 className="text-xl font-bold text-ink">{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-ink">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted uppercase">Business Name</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Acme Supplies Ltd"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted uppercase">Contact Person</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={formData.contactPerson}
                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                        placeholder="Full Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted uppercase">Category</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="e.g. Electronics"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted uppercase">Phone Number</label>
                      <input
                        type="tel"
                        required
                        className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="07..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted uppercase">Email Address</label>
                      <input
                        type="email"
                        className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="vendor@example.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted uppercase">Physical Address</label>
                    <textarea
                      className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-h-[80px]"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Street, Building, City"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-bg border border-border rounded-2xl space-y-4">
                    <h4 className="text-sm font-bold text-ink uppercase tracking-wider border-b border-border pb-2">Financials</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted uppercase">Total Supplied ({businessProfile?.currency || 'KSh'})</label>
                        <input
                          type="number"
                          className="w-full px-4 py-2.5 bg-card border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          value={formData.totalSupplied || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setFormData({ ...formData, totalSupplied: isNaN(val) ? 0 : val });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted uppercase">Total Paid ({businessProfile?.currency || 'KSh'})</label>
                        <input
                          type="number"
                          className="w-full px-4 py-2.5 bg-card border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          value={formData.totalPaid || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setFormData({ ...formData, totalPaid: isNaN(val) ? 0 : val });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted uppercase">Balance Owed ({businessProfile?.currency || 'KSh'})</label>
                        <input
                          type="number"
                          className="w-full px-4 py-2.5 bg-card border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          value={formData.balance || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setFormData({ ...formData, balance: isNaN(val) ? 0 : val });
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted uppercase">Supplied Products</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={newProduct}
                        onChange={(e) => setNewProduct(e.target.value)}
                        placeholder="Add product name..."
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProduct())}
                      />
                      <button
                        type="button"
                        onClick={addProduct}
                        className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
                      >
                        <Plus className="w-6 h-6" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.suppliedProducts?.map((product, index) => (
                        <span key={index} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 text-indigo-600 text-xs font-bold rounded-xl border border-indigo-500/20">
                          {product}
                          <button type="button" onClick={() => removeProduct(index)} className="hover:text-rose-500">
                            <Plus className="w-4 h-4 rotate-45" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 transition-all"
              >
                {editingSupplier ? 'Update Supplier' : 'Save Supplier'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setSupplierToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Delete Supplier?"
        message="Are you sure you want to delete this supplier? This action cannot be undone and will remove all associated records."
        itemName={suppliers.find(s => s.id === supplierToDelete)?.name}
      />
    </div>
  );
};
