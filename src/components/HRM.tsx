import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Employee, Attendance, Payroll, BusinessProfile, UserProfile } from '../types';
import { 
  Plus, 
  Search, 
  Users, 
  UserCheck, 
  Calendar, 
  DollarSign, 
  Clock,
  Briefcase,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Download,
  AlertTriangle,
  UserX,
  UserMinus,
  X
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface HRMProps {
  businessId: string;
  shopId: string;
  user: UserProfile;
}

export const HRM: React.FC<HRMProps> = ({ businessId, shopId, user }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allAttendance, setAllAttendance] = useState<Attendance[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  
  const [formData, setFormData] = useState<Omit<Employee, 'id'>>({
    businessId,
    shopId,
    name: '',
    email: '',
    phone: '',
    role: '',
    salary: 0,
    hireDate: new Date().toISOString().split('T')[0],
    status: 'ACTIVE'
  });

  useEffect(() => {
    const fetchData = async () => {
      const [emps, profile, attendances] = await Promise.all([
        db.getEmployees(businessId, shopId),
        db.getBusinessById(businessId),
        db.getAllAttendance()
      ]);
      setEmployees(emps);
      setBusinessProfile(profile);
      setAllAttendance(attendances);
    };
    fetchData();

    const handleDataUpdate = (e: any) => {
      if (['dmi_pos_employees', 'dmi_pos_businesses', 'dmi_pos_attendance'].includes(e.detail?.key)) {
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
    await db.addEmployee(formData);
    const freshEmployees = await db.getEmployees(businessId, shopId);
    setEmployees(freshEmployees);
    setIsModalOpen(false);
    setFormData({
      businessId,
      shopId,
      name: '',
      email: '',
      phone: '',
      role: '',
      salary: 0,
      hireDate: new Date().toISOString().split('T')[0],
      status: 'ACTIVE'
    });
  };

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number | undefined | null) => {
    const currency = businessProfile?.currency || 'KSh';
    if (amount === undefined || amount === null) return `${currency}0`;
    return `${currency}${amount.toLocaleString()}`;
  };

  const handleCheckIn = async () => {
    if (!selectedEmployee) return;
    const attendance: Omit<Attendance, 'id'> = {
      employeeId: selectedEmployee.id,
      date: new Date().toISOString().split('T')[0],
      checkIn: new Date().toLocaleTimeString(),
      status: 'PRESENT'
    };
    await db.addAttendance(attendance);
    alert(`${selectedEmployee.name} checked in successfully!`);
  };

  const handleCheckOut = async () => {
    if (!selectedEmployee) return;
    const today = new Date().toISOString().split('T')[0];
    const attendances = await db.getAttendance(selectedEmployee.id);
    const attendance = attendances.find(a => a.date === today);
    if (attendance) {
      await db.deleteAttendance(attendance.id);
      await db.addAttendance({
        ...attendance,
        checkOut: new Date().toLocaleTimeString()
      });
      alert(`${selectedEmployee.name} checked out successfully!`);
    } else {
      alert('No check-in record found for today.');
    }
  };

  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<string>('CASH');
  const [payReference, setPayReference] = useState<string>('');

  const handlePaySalary = async () => {
    if (!selectedEmployee) return;
    const payroll: Omit<Payroll, 'id'> = {
      employeeId: selectedEmployee.id,
      period: format(new Date(), 'yyyy-MM'),
      baseSalary: selectedEmployee.salary,
      allowances: 0,
      deductions: 0,
      netSalary: selectedEmployee.salary,
      paymentDate: new Date().toISOString().split('T')[0],
      status: 'PAID',
      method: payMethod,
      reference: payReference
    };
    await db.addPayroll(payroll);
    setIsPayModalOpen(false);
    setPayReference('');
    alert(`Salary paid to ${selectedEmployee.name} successfully!`);
  };

  const handleStatusChange = async (status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE') => {
    if (!selectedEmployee) return;
    await db.updateEmployee(selectedEmployee.id, { status });
    const freshEmployees = await db.getEmployees(businessId, shopId);
    setEmployees(freshEmployees);
    setSelectedEmployee({ ...selectedEmployee, status });
  };

  const handleDeleteClick = (employee: Employee) => {
    setEmployeeToDelete(employee);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (employeeToDelete) {
      await db.deleteEmployee(employeeToDelete.id);
      const freshEmployees = await db.getEmployees(businessId, shopId);
      setEmployees(freshEmployees);
      if (selectedEmployee?.id === employeeToDelete.id) setSelectedEmployee(null);
      setIsDeleteModalOpen(false);
      setEmployeeToDelete(null);
    }
  };

  const handleDownloadCSV = () => {
    const headers = ['Name', 'Role', 'Phone', 'Email', 'Salary', 'Hire Date', 'Status'];
    const rows = employees.map(e => [
      e.name,
      e.role,
      e.phone,
      e.email || '',
      e.salary.toString(),
      e.hireDate,
      e.status
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `employees_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const attendancePercentage = React.useMemo(() => {
    if (employees.length === 0) return 0;
    
    const now = new Date();
    const start = startOfMonth(now);
    const end = now; 
    
    // Use string comparison for dates to avoid timezone issues
    const startDateStr = format(start, 'yyyy-MM-dd');
    const endDateStr = format(end, 'yyyy-MM-dd');
    
    // Calculate expected attendance days (only include days up to today)
    const daysInMonthToDate = eachDayOfInterval({ start, end });
    
    const employeeIds = new Set(employees.map(e => e.id));
    const monthlyAttendance = allAttendance.filter(a => {
      return employeeIds.has(a.employeeId) && 
             a.date >= startDateStr && 
             a.date <= endDateStr && 
             a.status === 'PRESENT';
    });

    const uniqueAttendanceCount = new Set(monthlyAttendance.map(a => `${a.employeeId}-${a.date}`)).size;
    const totalPossibleAttendances = employees.length * daysInMonthToDate.length;

    if (totalPossibleAttendances === 0) return 0;
    const percentage = Math.min(100, Math.round((uniqueAttendanceCount / totalPossibleAttendances) * 100));
    return percentage;
  }, [employees, allAttendance]);

  const todayAttendance = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const presentToday = allAttendance.filter(a => a.date === today && a.status === 'PRESENT');
    if (employees.length === 0) return 0;
    return Math.round((presentToday.length / employees.length) * 100);
  }, [employees, allAttendance]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-ink">Human Resource Management</h2>
          <p className="text-sm text-muted">Manage employees, attendance, and payroll</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-border text-ink font-bold rounded-2xl shadow-sm hover:bg-muted transition-all"
          >
            <Download className="w-5 h-5" />
            Download CSV
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Employee
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-muted uppercase">Total Staff</span>
          </div>
          <p className="text-3xl font-bold text-ink">{employees.length}</p>
          <p className="text-[10px] text-muted mt-2 font-bold uppercase">Active Employees</p>
        </div>
        
        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
              <UserCheck className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-muted uppercase">Today's Presence</span>
          </div>
          <p className="text-3xl font-bold text-emerald-500">
            {todayAttendance}%
          </p>
          <p className="text-[10px] text-muted mt-2 font-bold uppercase text-emerald-600">Live Status</p>
        </div>

        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
              <DollarSign className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-muted uppercase">Payroll Liability</span>
          </div>
          <p className="text-3xl font-bold text-ink">
            {formatCurrency(employees.reduce((sum, e) => sum + e.salary, 0))}
          </p>
          <p className="text-[10px] text-muted mt-2 font-bold uppercase">Total Monthly Cost</p>
        </div>

        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm group">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-500/10 rounded-2xl text-violet-500 group-hover:bg-violet-500 group-hover:text-white transition-all">
                <Clock className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-muted uppercase">Monthly Accuracy</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-ink">{attendancePercentage}%</p>
          <p className="text-[10px] text-muted mt-2 font-bold uppercase">Aggregated Stats</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Employee List */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border">
              <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search staff by name or role..."
                  className="w-full pl-12 pr-4 py-3 bg-bg border border-border text-ink rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg/50">
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Employee</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Role</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Salary</th>
                    <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEmployees.map((employee) => (
                    <tr 
                      key={employee.id} 
                      className={`hover:bg-bg/30 transition-colors cursor-pointer ${selectedEmployee?.id === employee.id ? 'bg-indigo-500/5' : ''}`}
                      onClick={() => setSelectedEmployee(employee)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold shadow-lg">
                            {employee.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-ink">{employee.name}</p>
                            <p className="text-[10px] text-muted font-bold uppercase tracking-tighter">{employee.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted font-medium">
                        {employee.role}
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase ${
                          employee.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 
                          employee.status === 'ON_LEAVE' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'
                        }`}>
                          {employee.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-bold text-ink">
                        {formatCurrency(employee.salary)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-2 text-indigo-500 hover:bg-indigo-500/10 rounded-xl transition-all">
                            <Briefcase className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(employee);
                            }}
                            className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Employee Detail / Quick Actions */}
        <div className="lg:col-span-4 space-y-6">
          {selectedEmployee ? (
            <div className="bg-card border border-border rounded-3xl shadow-sm p-6 space-y-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-indigo-600 text-white rounded-3xl flex items-center justify-center font-bold text-3xl shadow-xl mb-4">
                  {selectedEmployee.name.charAt(0)}
                </div>
                <h3 className="text-xl font-bold text-ink">{selectedEmployee.name}</h3>
                <p className="text-sm text-muted font-bold uppercase tracking-widest mb-4">{selectedEmployee.role}</p>
                <div className="flex gap-2">
                  <a 
                    href={`tel:${selectedEmployee.phone}`}
                    className="p-2 bg-bg border border-border text-indigo-500 rounded-xl hover:bg-muted transition-all"
                    title={`Call ${selectedEmployee.name}`}
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                  {selectedEmployee.email && (
                    <a 
                      href={`mailto:${selectedEmployee.email}`}
                      className="p-2 bg-bg border border-border text-indigo-500 rounded-xl hover:bg-muted transition-all"
                      title={`Email ${selectedEmployee.name}`}
                    >
                      <Mail className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-bg rounded-2xl border border-border">
                  <p className="text-[10px] font-bold text-muted uppercase mb-2">Quick Actions</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={handleCheckIn}
                      className="flex flex-col items-center gap-2 p-3 bg-card border border-border rounded-xl hover:border-indigo-500 transition-all"
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span className="text-[10px] font-bold uppercase">Check In</span>
                    </button>
                    <button 
                      onClick={handleCheckOut}
                      className="flex flex-col items-center gap-2 p-3 bg-card border border-border rounded-xl hover:border-indigo-500 transition-all"
                    >
                      <XCircle className="w-5 h-5 text-rose-500" />
                      <span className="text-[10px] font-bold uppercase">Check Out</span>
                    </button>
                    <button 
                      onClick={() => setIsPayModalOpen(true)}
                      className="flex flex-col items-center gap-2 p-3 bg-card border border-border rounded-xl hover:border-indigo-500 transition-all"
                    >
                      <DollarSign className="w-5 h-5 text-indigo-500" />
                      <span className="text-[10px] font-bold uppercase">Pay Salary</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-bg rounded-2xl border border-border">
                  <p className="text-[10px] font-bold text-muted uppercase mb-3">Status Management</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => handleStatusChange('ACTIVE')}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                        selectedEmployee.status === 'ACTIVE' 
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                          : 'bg-card border-border text-muted hover:border-emerald-500'
                      }`}
                    >
                      <CheckCircle2 className={`w-4 h-4 ${selectedEmployee.status === 'ACTIVE' ? 'text-white' : 'text-emerald-500'}`} />
                      <span className="text-[8px] font-bold uppercase">Active</span>
                    </button>
                    <button 
                      onClick={() => handleStatusChange('ON_LEAVE')}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                        selectedEmployee.status === 'ON_LEAVE' 
                          ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20' 
                          : 'bg-card border-border text-muted hover:border-amber-500'
                      }`}
                    >
                      <AlertCircle className={`w-4 h-4 ${selectedEmployee.status === 'ON_LEAVE' ? 'text-white' : 'text-amber-500'}`} />
                      <span className="text-[8px] font-bold uppercase">Leave</span>
                    </button>
                    <button 
                      onClick={() => handleStatusChange('INACTIVE')}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                        selectedEmployee.status === 'INACTIVE' 
                          ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/20' 
                          : 'bg-card border-border text-muted hover:border-rose-500'
                      }`}
                    >
                      <UserX className={`w-4 h-4 ${selectedEmployee.status === 'INACTIVE' ? 'text-white' : 'text-rose-500'}`} />
                      <span className="text-[8px] font-bold uppercase">Inactive</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-bg rounded-2xl border border-border">
                  <p className="text-[10px] font-bold text-muted uppercase mb-2">Employment Info</p>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Hire Date</span>
                      <span className="text-ink font-bold">{format(new Date(selectedEmployee.hireDate), 'MMM dd, yyyy')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Monthly Salary</span>
                      <span className="text-ink font-bold">{formatCurrency(selectedEmployee.salary)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Status</span>
                      <span className={`font-bold ${
                        selectedEmployee.status === 'ACTIVE' ? 'text-emerald-500' :
                        selectedEmployee.status === 'ON_LEAVE' ? 'text-amber-500' : 'text-rose-500'
                      }`}>{selectedEmployee.status}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-3xl shadow-sm p-12 text-center flex flex-col items-center justify-center gap-4">
              <Users className="w-12 h-12 text-muted opacity-20" />
              <p className="text-sm text-muted">Select an employee to view details and manage actions</p>
            </div>
          )}
        </div>
      </div>

      {/* Pay Salary Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-card rounded-3xl w-full max-w-md shadow-2xl p-8 relative border border-border">
            <button 
              onClick={() => setIsPayModalOpen(false)}
              className="absolute top-4 right-4 p-2 hover:bg-muted/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-muted" />
            </button>
            <h2 className="text-xl font-bold text-ink mb-6">Pay Salary</h2>
            <div className="space-y-4">
              <div className="p-4 bg-muted/10 rounded-xl border border-border">
                <p className="text-xs font-bold text-muted uppercase mb-1">Employee</p>
                <p className="text-lg font-bold text-ink">{selectedEmployee?.name}</p>
                <p className="text-sm text-indigo-600 font-bold">{formatCurrency(selectedEmployee?.salary || 0)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase">Payment Method</label>
                <select 
                  className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  <option value="CASH">Cash</option>
                  <option value="MPESA">M-Pesa</option>
                  <option value="BANK">Bank Transfer</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase">Reference (Optional)</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="Transaction ID, Check #, etc."
                />
              </div>
              <button 
                onClick={handlePaySalary}
                className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg hover:bg-emerald-700 transition-all mt-4"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setEmployeeToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Employee"
        message="Are you sure you want to delete this employee? This action cannot be undone."
        itemName={employeeToDelete?.name}
      />

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-xl font-bold text-ink">Add New Employee</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-ink">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase">Full Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Employee Full Name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted uppercase">Role / Position</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.role || ''}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="e.g. Cashier"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted uppercase">Monthly Salary</label>
                  <input
                    type="number"
                    required
                    className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.salary || ''}
                    onChange={(e) => setFormData({ ...formData, salary: Number(e.target.value) })}
                    placeholder="0.00"
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
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="07..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted uppercase">Hire Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.hireDate || ''}
                    onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted uppercase">Email Address</label>
                  <input
                    type="email"
                    className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="employee@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted uppercase">Initial Status</label>
                  <select
                    className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.status || ''}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="ON_LEAVE">On Leave</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 transition-all"
              >
                Save Employee
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
