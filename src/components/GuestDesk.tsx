import React, { useState, useEffect } from 'react';
import { GuestRequest, UserProfile } from '../types';
import { localDb } from '../services/localDb';
import { 
  Wrench, 
  MessageSquare, 
  PlusCircle, 
  CheckCircle, 
  AlertCircle, 
  Star, 
  ClipboardList, 
  User, 
  Building,
  ArrowRight,
  Sparkles,
  Smartphone,
  Check,
  Trash2,
  ListFilter,
  Layers,
  ThumbsUp,
  HeartHandshake,
  QrCode,
  Printer,
  ExternalLink,
  Copy,
  Mail,
  Share2,
  Wifi,
  Battery
} from 'lucide-react';

interface GuestDeskProps {
  businessId: string;
  shopId: string;
  user: UserProfile;
}

export const GuestDeskPanel: React.FC<GuestDeskProps> = ({
  businessId,
  shopId,
  user
}) => {
  const [requests, setRequests] = useState<GuestRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'INBOX' | 'SIMULATOR'>('INBOX');
  
  // Dashboard Filters
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'REPAIR' | 'FEEDBACK' | 'HOUSEKEEPING'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED'>('ALL');
  const [roomFilter, setRoomFilter] = useState('');

  // Simulator Form State
  const [formType, setFormType] = useState<GuestRequest['type']>('REPAIR');
  const [roomNo, setRoomNo] = useState('');
  const [guestName, setGuestName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<GuestRequest['priority']>('MEDIUM');
  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);

  // QR share states
  const [copied, setCopied] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailDispatched, setEmailDispatched] = useState(false);

  const fetchRequests = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    const data = await localDb.getGuestRequests(businessId, shopId);
    setRequests(data);
    if (!isSilent) setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
    
    // Seed sample initial mock data to look outstanding right away!
    const seedInitialData = async () => {
      const existing = await localDb.getGuestRequests(businessId, shopId);
      if (existing.length === 0) {
        const samples: Omit<GuestRequest, 'id'>[] = [
          {
            businessId,
            shopId,
            roomNo: 'Apt 2B',
            guestName: 'Richard Hendrick',
            type: 'REPAIR',
            title: 'Living Room Wi-Fi weak connection',
            description: 'The Wi-Fi drops signals frequently in the master bedroom and living room area. Kindly check the router position.',
            priority: 'HIGH',
            status: 'PENDING',
            createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
          },
          {
            businessId,
            shopId,
            roomNo: 'Apt 5',
            guestName: 'Sarah Connor',
            type: 'REPAIR',
            title: 'Shower leaking warm water',
            description: 'The thermostat valve under the shower has a minute leakage. We are losing water pressure in the morning.',
            priority: 'MEDIUM',
            status: 'IN_PROGRESS',
            createdAt: new Date(Date.now() - 3600000 * 18).toISOString()
          },
          {
            businessId,
            shopId,
            roomNo: 'Penthouse 101',
            guestName: 'Elon Mars',
            type: 'FEEDBACK',
            title: 'Spectacular stay and view',
            description: 'Amazing view and interior details! The automated balcony shades work like a charm. 10/10 stay.',
            rating: 5,
            priority: 'LOW',
            status: 'RESOLVED',
            createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
          },
          {
            businessId,
            shopId,
            roomNo: 'Apt 4A',
            guestName: 'Clara Oswald',
            type: 'HOUSEKEEPING',
            title: 'Fresh bedsheets and towels needed',
            description: 'Requesting a quick towel swap and complementary coffee pod replenishment details today.',
            priority: 'LOW',
            status: 'RESOLVED',
            createdAt: new Date(Date.now() - 3600000 * 48).toISOString()
          }
        ];
        
        for (const sample of samples) {
          await localDb.addGuestRequest(sample);
        }
        fetchRequests();
      }
    };
    
    seedInitialData();

    // Live sync polling interval: checks live database every 4 seconds to sync client devices
    const syncInterval = setInterval(() => {
      fetchRequests(true);
    }, 4000);

    return () => clearInterval(syncInterval);
  }, [businessId, shopId]);

  const handleUpdateStatus = async (id: string, newStatus: GuestRequest['status']) => {
    await localDb.updateGuestRequestStatus(id, newStatus);
    fetchRequests();
  };

  const handleDeleteRequest = async (id: string) => {
    if (confirm('Are you sure you want to delete this guest request?')) {
      await localDb.deleteGuestRequest(id);
      fetchRequests();
    }
  };

  const handleSimulatorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNo.trim() || !guestName.trim() || !title.trim() || !description.trim()) {
      alert('Please fill out all fields first.');
      return;
    }

    const payload: Omit<GuestRequest, 'id'> = {
      businessId,
      shopId,
      roomNo,
      guestName,
      type: formType,
      title,
      description,
      priority,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      ...(formType === 'FEEDBACK' ? { rating } : {})
    };

    await localDb.addGuestRequest(payload);
    
    // Clear Form
    setTitle('');
    setDescription('');
    setShowSuccessAlert(true);
    fetchRequests();

    setTimeout(() => {
      setShowSuccessAlert(false);
    }, 5000);
  };

  // Calculations
  const totalRepairs = requests.filter(r => r.type === 'REPAIR').length;
  const pendingRepairs = requests.filter(r => r.type === 'REPAIR' && r.status !== 'RESOLVED').length;
  
  const feedbackRequests = requests.filter(r => r.type === 'FEEDBACK' && r.rating);
  const averageRating = feedbackRequests.length > 0 
    ? (feedbackRequests.reduce((sum, r) => sum + (r.rating || 0), 0) / feedbackRequests.length).toFixed(1)
    : '5.0';

  const satisfiedPercentage = feedbackRequests.length > 0
    ? Math.round((feedbackRequests.filter(r => (r.rating || 0) >= 4).length / feedbackRequests.length) * 100)
    : 100;

  const filteredRequests = requests.filter(r => {
    const matchesType = typeFilter === 'ALL' || r.type === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchesRoom = !roomFilter || (r.roomNo && String(r.roomNo).toLowerCase().includes(String(roomFilter).toLowerCase()));
    return matchesType && matchesStatus && matchesRoom;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" id="guest-desk-root">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card border border-border p-6 rounded-3xl shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-ink flex items-center gap-3">
            <HeartHandshake className="w-8 h-8 text-indigo-600 animate-pulse" />
            Guest Desk & Experience Portals
          </h2>
          <p className="text-sm text-muted mt-1">
            Track stay experience ratings, dispatch repair work orders, and handle real-time complaints filed by active hosts.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-bg p-1 rounded-xl self-start md:self-auto border border-border">
          <button
            onClick={() => setActiveSubTab('INBOX')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeSubTab === 'INBOX' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-muted hover:text-ink'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Management Board ({requests.length})
          </button>
          <button
            onClick={() => setActiveSubTab('SIMULATOR')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeSubTab === 'SIMULATOR' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-muted hover:text-ink'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-500" />
            Guest QR Portal (Sim)
          </button>
        </div>
      </div>

      {/* Stats row */}
      {activeSubTab === 'INBOX' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-bold text-muted uppercase">Unresolved Repairs</p>
              <p className="text-2xl font-extrabold text-indigo-600 mt-1">{pendingRepairs} / {totalRepairs}</p>
            </div>
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Wrench className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-card border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-bold text-muted uppercase">Average rating</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-2xl font-extrabold text-amber-500">{averageRating}</span>
                <span className="text-xs text-muted">/ 5.0</span>
              </div>
            </div>
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
              <Star className="w-5 h-5 fill-current" />
            </div>
          </div>

          <div className="bg-card border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-bold text-muted uppercase">Guest Satisfaction</p>
              <p className="text-2xl font-extrabold text-emerald-600 mt-1">{satisfiedPercentage}%</p>
            </div>
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <ThumbsUp className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-card border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-bold text-muted uppercase">Total Requests logged</p>
              <p className="text-2xl font-extrabold text-ink mt-1">{requests.length}</p>
            </div>
            <div className="w-10 h-10 bg-bg rounded-xl flex items-center justify-center text-muted">
              <Layers className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'INBOX' ? (
        <div className="space-y-4">
          {/* Filtering bar */}
          <div className="bg-card border border-border p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-muted font-bold">
                <ListFilter className="w-4 h-4" />
                <span>Filters:</span>
              </div>
              
              {/* Category selector */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-bg border border-border rounded-xl font-medium outline-none text-ink text-xs focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Categories</option>
                <option value="REPAIR">Repairs & Maintenance</option>
                <option value="FEEDBACK">Feedback & Stay Reviews</option>
                <option value="HOUSEKEEPING">Housekeeping Swaps</option>
              </select>

              {/* Status selector */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-bg border border-border rounded-xl font-medium outline-none text-ink text-xs focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Approval</option>
                <option value="IN_PROGRESS">W.I.P. Dispatch</option>
                <option value="RESOLVED">Resolved / Done</option>
              </select>
            </div>

            {/* Room search filter */}
            <div className="relative w-full md:w-64">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="Filter Room / Apartment..."
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-bg border border-border rounded-xl outline-none text-xs focus:ring-2 focus:ring-indigo-500 text-ink"
              />
            </div>
          </div>

          {/* Inbox Requests Render */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              <div className="md:col-span-2 text-center p-12 text-muted text-sm">
                Fetching guest bookings ledger...
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="md:col-span-2 text-center bg-card border border-border p-12 rounded-2xl text-muted text-sm flex flex-col items-center gap-2">
                <ClipboardList className="w-8 h-8 opacity-20" />
                <span>No guest requests match active filters in your lodging dashboard.</span>
              </div>
            ) : (
              filteredRequests.map((req) => (
                <div 
                  key={req.id}
                  className={`bg-card border p-5 rounded-2xl shadow-sm transition-all border-border hover:border-indigo-400 flex flex-col justify-between`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[9px] font-black tracking-wider rounded uppercase ${
                          req.type === 'REPAIR' 
                            ? 'bg-rose-50 text-rose-500 border border-rose-100' 
                            : req.type === 'FEEDBACK' 
                            ? 'bg-amber-50 text-amber-500 border border-amber-100' 
                            : 'bg-indigo-50 text-indigo-500 border border-indigo-100'
                        }`}>
                          {req.type === 'REPAIR' ? 'Repair' : req.type === 'FEEDBACK' ? 'Feedback' : 'Cleaning'}
                        </span>
                        <span className="text-xs text-slate-500 font-bold font-mono">
                          {req.roomNo}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 text-[9px] font-extrabold tracking-wider rounded uppercase ${
                        req.priority === 'HIGH' 
                          ? 'bg-rose-100 text-rose-600' 
                          : req.priority === 'MEDIUM' 
                          ? 'bg-amber-100 text-amber-600' 
                          : 'bg-neutral-100 text-neutral-600'
                      }`}>
                        {req.priority}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-ink text-sm flex items-center gap-1.5">
                        {req.title}
                        {req.type === 'FEEDBACK' && req.rating && (
                          <span className="text-amber-500 text-xs flex items-center gap-0.5 font-bold">
                            ★ {req.rating}
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-muted mt-1 leading-relaxed">{req.description}</p>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <User className="w-3 h-3" />
                      <span>{req.guestName}</span>
                      <span>•</span>
                      <span>{new Date(req.createdAt).toLocaleDateString()} at {new Date(req.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </div>

                  {/* Actions bar */}
                  <div className="flex items-center justify-between border-t border-border mt-4 pt-3 text-xs gap-2">
                    <div className="flex gap-2">
                      {req.status === 'PENDING' && (
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'IN_PROGRESS')}
                          className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg font-bold transition-all text-[11px]"
                        >
                          Dispatch Work
                        </button>
                      )}
                      {req.status !== 'RESOLVED' && (
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'RESOLVED')}
                          className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg font-bold transition-all text-[11px]"
                        >
                          Mark Resolved
                        </button>
                      )}
                      {req.status === 'RESOLVED' && (
                        <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                          <Check className="w-3 h-3 font-extrabold" /> Completed
                        </span>
                      )}
                    </div>
                    
                    <button
                      onClick={() => handleDeleteRequest(req.id)}
                      className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Guest QR Portal Interface Simulator */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Working QR Code & Print Poster Hub */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* The Actual Guest QR Code Card */}
            <div className="bg-card border border-border rounded-3xl p-6 shadow-xl relative overflow-hidden space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-black bg-indigo-50 dark:bg-zinc-800 text-indigo-600 dark:text-purple-400 rounded-full uppercase tracking-wider">
                    <QrCode className="w-3.5 h-3.5" />
                    Interactive Room QR Code
                  </span>
                  <h3 className="font-black text-ink text-base">Direct Scan Ready Code</h3>
                </div>
              </div>

              {/* Working Code Renderer Container */}
              <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-2xl flex flex-col items-center justify-center border border-border/60 relative group">
                {/* Dynamically calculated URL with the exact server location of this dev app! */}
                {(() => {
                  const guestUrl = `${window.location.origin}?mode=guest&businessId=${businessId}&shopId=${shopId}`;
                  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(guestUrl)}`;
                  
                  return (
                    <>
                      {/* Real Vector-rendered QR Code with scanner helper guides */}
                      <div className="relative p-3 bg-white border rounded-2xl shadow-sm transition-transform duration-300 hover:scale-105 shrink-0">
                        {/* QR guide corners */}
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-indigo-600 rounded-tl"></div>
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-indigo-600 rounded-tr"></div>
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-indigo-600 rounded-bl"></div>
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-indigo-600 rounded-br"></div>
                        
                        <img 
                          src={qrCodeApiUrl} 
                          alt="Room Guest Portal QR Code" 
                          referrerPolicy="no-referrer"
                          className="w-48 h-48 block object-contain select-none"
                        />
                      </div>
                      
                      {/* Short instructions */}
                      <p className="text-[11px] text-muted text-center mt-4 max-w-xs font-medium">
                        Scan the code using any iOS or Android camera. It redirects directly to your specific hotel guest feedback loop screen!
                      </p>

                      {/* Direct Clickable URL bar */}
                      <div className="w-full mt-4 p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-border text-center">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Your Real Guest Link</p>
                        <p className="font-mono text-[10px] text-indigo-600 dark:text-purple-400 break-all select-all font-semibold px-1">
                          {guestUrl}
                        </p>
                      </div>

                      {/* Interactive Triggers Row */}
                      <div className="grid grid-cols-2 gap-2 w-full mt-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(guestUrl);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="py-2 px-3 bg-indigo-50 dark:bg-zinc-800 hover:bg-indigo-100/80 hover:dark:bg-zinc-700 text-indigo-600 dark:text-purple-400 font-bold rounded-xl text-center active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5"
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 shrink-0" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>

                        <a
                          href={guestUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-center active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/10"
                        >
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          <span>Launch Port</span>
                        </a>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Personalized host email delivery action */}
              <div className="pt-2">
                {emailDispatched ? (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 p-3.5 rounded-2xl border border-emerald-200 text-xs font-bold text-center flex items-center justify-center gap-2 animate-fade-in">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span>QR Pack emailed safely to migichidave09@gmail.com!</span>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEmailSending(true);
                      setTimeout(() => {
                        setEmailSending(false);
                        setEmailDispatched(true);
                      }, 1200);
                    }}
                    disabled={emailSending}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-extrabold rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    {emailSending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                        <span>Sending to registered mailbox...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>Send QR Kit to user: migichidave09@gmail.com</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Print Standee Poster Design Mockup */}
            <div className="bg-card border border-border p-6 rounded-3xl space-y-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center gap-2 text-ink justify-between">
                <h4 className="font-bold text-sm flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-muted" />
                  Print Room Card Standee
                </h4>
                <button
                  onClick={() => window.print()}
                  className="px-2.5 py-1 hover:bg-slate-150 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition-all"
                >
                  <Printer className="w-3 h-3" />
                  Print
                </button>
              </div>
              
              {/* Standee design */}
              <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-dashed text-center text-slate-800 dark:text-zinc-200 mx-auto max-w-xs space-y-4 select-none">
                <div className="space-y-1">
                  <p className="font-serif italic text-lg tracking-wide text-indigo-700 dark:text-indigo-400">Welcome to Your Stay</p>
                  <div className="h-[2px] w-12 bg-indigo-600 mx-auto rounded"></div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-500 dark:text-zinc-400">
                  <p className="font-bold text-[11px] text-slate-700 dark:text-zinc-300">Need immediate assistance or fresh amenities?</p>
                  <p className="text-[10px] leading-relaxed">Scan this code to request extra towels, order room service, or log maintenance tickets.</p>
                </div>

                {/* Simulated center placeholder */}
                <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-xl flex items-center justify-center mx-auto text-[10px] text-muted font-bold font-mono">
                  [ QR CODE ]
                </div>

                <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">
                  No login required • Instant Response
                </div>
              </div>
            </div>

          </div>

          {/* Interactive Mobile Simulator (Android/iOS Viewport wrapper) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-bold text-muted uppercase">Interactive Screen Preview</span>
              <span className="text-[11px] font-black text-indigo-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Fits perfectly on iOS & Android Safari/Chrome
              </span>
            </div>

            <div className="bg-slate-900 border-[10px] border-slate-700 dark:border-zinc-800 rounded-[3.2rem] p-4 max-w-sm mx-auto shadow-2xl relative overflow-hidden ring-1 ring-slate-100 flex items-center justify-center aspect-[9/19] min-h-[680px]">
              {/* Device Island Speaker Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-700 dark:bg-zinc-800 rounded-b-2xl z-20 flex items-center justify-center">
                <div className="w-12 h-1 bg-zinc-950 rounded-full"></div>
              </div>

              {/* Display screen frame viewport simulation */}
              <div className="bg-slate-50 dark:bg-zinc-900 w-full h-full rounded-[2.5rem] overflow-hidden relative flex flex-col justify-between text-slate-800 dark:text-zinc-200 shadow-inner">
                
                {/* Simulated Smartphone Header Status Bar */}
                <div className="px-6 pt-3 pb-1 flex items-center justify-between text-[10px] font-bold select-none z-10 shrink-0 text-slate-500">
                  <span>10:42 AM</span>
                  <div className="flex items-center gap-1">
                    <Wifi className="w-3 h-3 text-slate-400" />
                    <Battery className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>

                {/* Sub-content */}
                <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
                  <div className="text-center pt-2 pb-1">
                    <h4 className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest flex items-center justify-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-indigo-600 duration-1000 rotate-12" />
                      Room Direct Desk
                    </h4>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Active Guest Service</h3>
                  </div>

                  {showSuccessAlert && (
                    <div className="bg-emerald-50 text-emerald-700 text-xs font-bold p-3 rounded-xl border border-emerald-150 flex items-start gap-2 animate-bounce">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-[11px]">Request Lodged</p>
                        <p className="font-normal text-[10px] opacity-90 mt-0.5">Dispatched to host dashboard.</p>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSimulatorSubmit} className="space-y-3 text-xs">
                    {/* Select Request Form Type */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase text-[9px]">Select Category</label>
                      <div className="grid grid-cols-3 gap-0.5 bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg">
                        {(['REPAIR', 'HOUSEKEEPING', 'FEEDBACK'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setFormType(t)}
                            className={`py-1 text-[9px] font-black rounded-md text-center transition-all uppercase ${
                              formType === t 
                                ? 'bg-white dark:bg-zinc-700 text-indigo-600 shadow-sm'
                                : 'text-slate-500'
                            }`}
                          >
                            {t === 'REPAIR' ? 'Repair' : t === 'HOUSEKEEPING' ? 'Housekeep' : 'Review'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Room Input */}
                      <div className="space-y-1">
                        <label className="font-bold text-slate-500 uppercase text-[9px]">Room / Suite No</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Suite 4"
                          value={roomNo}
                          onChange={(e) => setRoomNo(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none focus:border-indigo-500 text-slate-850 text-[11px]"
                        />
                      </div>
                      {/* Name Input */}
                      <div className="space-y-1">
                        <label className="font-bold text-slate-500 uppercase text-[9px]">Guest Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Dave"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none focus:border-indigo-500 text-slate-850 text-[11px]"
                        />
                      </div>
                    </div>

                    {/* Summary Title */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase text-[9px]">
                        {formType === 'REPAIR' 
                          ? 'What needs repair?' 
                          : formType === 'HOUSEKEEPING' 
                          ? 'Requested service?' 
                          : 'Review heading'}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={
                          formType === 'REPAIR' 
                            ? 'e.g. Wi-Fi router is sluggish'
                            : formType === 'HOUSEKEEPING' 
                            ? 'e.g. Order fresh dry towels' 
                            : 'e.g. Beautiful penthouse room!'
                        }
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none focus:border-indigo-500 text-slate-850 text-[11px]"
                      />
                    </div>

                    {/* Description Box */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase text-[9px]">Full details</label>
                      <textarea
                        required
                        placeholder="Provide details so host team serves you instantly."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none focus:border-indigo-500 min-h-[50px] text-slate-850 text-[10px]"
                      />
                    </div>

                    {/* Star Rating / Priority Toggle */}
                    {formType === 'FEEDBACK' ? (
                      <div className="space-y-1">
                        <label className="font-bold text-slate-500 uppercase text-[9px] block text-center">Score rating</label>
                        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 p-1.5 rounded-lg justify-center">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setRating(s)}
                              className="p-0.5 text-amber-400 font-bold hover:scale-110"
                            >
                              <Star 
                                className={`w-5 h-5 ${
                                  s <= rating ? 'fill-current' : 'text-slate-300'
                                }`} 
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 flex justify-between items-center bg-slate-100 dark:bg-zinc-800 p-1.5 rounded-lg">
                        <span className="font-bold text-slate-500 uppercase text-[8px]">Urgency</span>
                        <div className="flex gap-1">
                          {(['LOW', 'MEDIUM', 'HIGH'] as const).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setPriority(p)}
                              className={`px-2 py-0.5 text-[8px] font-black rounded uppercase ${
                                priority === p 
                                  ? 'bg-indigo-600 text-white' 
                                  : 'text-slate-500'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg text-center text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 shadow"
                    >
                      <span>Send Room Ticket</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </form>
                </div>

                <div className="p-3 bg-slate-100 dark:bg-zinc-950 text-center border-t border-slate-200 text-[8px] tracking-widest text-slate-400 uppercase font-black">
                  Distributed Hotel App Client
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const GuestDesk = GuestDeskPanel;
export default GuestDeskPanel;
