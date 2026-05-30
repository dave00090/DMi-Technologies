import React, { useState, useEffect } from 'react';
import { localDb } from '../services/localDb';
import { GuestRequest, BusinessProfile, Shop } from '../types';
import { 
  Wrench, 
  Sparkles, 
  Smartphone, 
  Check, 
  AlertCircle, 
  Star, 
  User, 
  Building,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Coffee,
  Heart,
  HelpCircle,
  Wifi,
  Battery,
  Lock,
  ChevronRight,
  Send,
  Moon,
  Sun
} from 'lucide-react';

interface GuestPortalProps {
  businessId: string;
  shopId: string;
}

export const GuestPortal: React.FC<GuestPortalProps> = ({ businessId, shopId }) => {
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [formType, setFormType] = useState<GuestRequest['type']>('REPAIR');
  const [roomNo, setRoomNo] = useState('');
  const [guestName, setGuestName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<GuestRequest['priority']>('MEDIUM');
  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [recentRequests, setRecentRequests] = useState<GuestRequest[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Simple Theme Toggle for Guest View (Separate from Cashier App to look super fancy)
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Synchronously look up the hotel business and active room / shop unit
    const biz = localDb.getBusinessById(businessId);
    if (biz) setBusiness(biz);

    const shp = localDb.getShopById(shopId);
    if (shp) setShop(shp);

    // Filter requests filed by this specific guest using local storage
    const loadRecent = async () => {
      const all = await localDb.getGuestRequests(businessId, shopId);
      // Sort by newest first
      setRecentRequests(all.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3));
    };
    loadRecent();

    // Live update guest requests list every 4 seconds to observe status changes instantly
    const pollInterval = setInterval(() => {
      loadRecent();
    }, 4000);

    // Device clock simulation
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(timer);
    };
  }, [businessId, shopId, submitSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNo.trim() || !guestName.trim() || !title.trim() || !description.trim()) {
      alert('Please fill out all fields before submitting your ticket.');
      return;
    }

    setIsSubmitting(true);

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

    // Save Guest Request in localized database
    await localDb.addGuestRequest(payload);
    
    // Simulate slight loading delay for native mobile app feel
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitSuccess(true);
      // Clear specific form inputs
      setTitle('');
      setDescription('');
    }, 1000);
  };

  const handleReset = () => {
    setSubmitSuccess(false);
  };

  const getFormSpecificSuggestions = () => {
    switch(formType) {
      case 'REPAIR':
        return [
          { t: 'Wi-Fi connection too slow', d: 'Unable to buffer video streams from the master bed.' },
          { t: 'Hot water not flowing', d: 'The bathroom tap is only releasing cold/warm water.' },
          { t: 'Air conditioner making noise', d: 'Clicking sounds coming from the ventilation filter.' }
        ];
      case 'HOUSEKEEPING':
        return [
          { t: 'Fresh bedsheets and linen request', d: 'We would love the sheets changed during afternoon cleanup.' },
          { t: 'Replenish bathroom towels', d: 'Requesting 2 fresh hand towels and 2 body towels please.' },
          { t: 'Complementary coffee & water', d: 'Please bring extra coffee pods and direct drinking water bottles.' }
        ];
      case 'SERVICE':
        return [
          { t: 'Luggage assistance', d: 'Requesting bellboy assistance for baggage drop-off upon checkout.' },
          { t: 'Late check-out request', d: 'Inquiring if we can hold our stay until 1:00 PM today.' },
          { t: 'Extra pillow & blanket', d: 'Need one additional hypoallergenic pillow for our child.' }
        ];
      default:
        return [
          { t: 'Exemplary host hospitality!', d: 'Loved the fast communication and extreme level of cleanliness!' },
          { t: 'Spectacular interior styling', d: 'The custom lighting features and premium view made our stay amazing.' },
          { t: 'Seamless room automated access', d: 'The smart keyless check-in process was highly convenient and modern.' }
        ];
    }
  };

  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`min-h-screen w-full flex flex-col justify-center items-center p-3 md:p-8 transition-colors duration-300 ${
      isDarkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-100 text-slate-800'
    }`} id="guest-portal-root">
      
      {/* Outer Shell - Behaves as standard fluid layout on phones, looks like a premium smartphone body on desktops */}
      <div className={`w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border flex flex-col min-h-[820px] relative transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-zinc-900 border-zinc-800 shadow-purple-950/20' 
          : 'bg-white border-slate-200/80 shadow-slate-300/50'
      }`}>
        
        {/* Simulated Smartphone Header Status Bar */}
        <div className={`px-6 py-2 flex items-center justify-between text-xs font-bold leading-none select-none z-10 shrink-0 ${
          isDarkMode ? 'bg-zinc-900/60 text-zinc-400' : 'bg-white/60 text-slate-500'
        }`}>
          <span>{formattedTime}</span>
          <div className="flex items-center gap-1">
            <Wifi className="w-3.5 h-3.5" />
            <span className="font-mono text-[9px] tracking-wide">LTE</span>
            <Battery className="w-4 h-4 ml-0.5" />
          </div>
        </div>

        {/* Guest Portal Top Header Card */}
        <div className={`p-5 pb-6 border-b transition-colors duration-300 shrink-0 ${
          isDarkMode ? 'bg-zinc-900 border-zinc-800/80' : 'bg-indigo-600 border-indigo-700 text-white'
        }`}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-black rounded-full uppercase tracking-widest ${
                isDarkMode ? 'bg-purple-950 text-purple-400 border border-purple-800' : 'bg-white/20 text-white'
              }`}>
                <Sparkles className="w-3 h-3 text-amber-300" />
                Live Guest Service
              </span>
              <h1 className="text-xl font-black tracking-tight mt-1 truncate max-w-[280px]">
                {business?.name || 'Exclusive Lodging'}
              </h1>
              <p className={`text-xs ${isDarkMode ? 'text-zinc-400' : 'text-indigo-100'}`}>
                Unit: <span className="font-mono font-bold">{shop?.name || 'Assigned Suite'}</span>
              </p>
            </div>

            {/* Micro Theme Button inside guest dashboard */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-xl transition-all ${
                isDarkMode 
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-amber-400' 
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title="Toggle theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Content Viewbox Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {submitSuccess ? (
            /* Splash Success Screen */
            <div className="py-12 px-2 text-center flex flex-col items-center justify-center space-y-6 animate-fade-in">
              <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl font-black">Request Locked In!</h2>
                <p className={`text-xs px-4 leading-relaxed ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                  Your room service order or maintenance work request has been dispatched directly to the host center. Staff are now notified!
                </p>
              </div>

              <div className={`p-4 rounded-2xl border text-left text-xs max-w-sm mx-auto space-y-1.5 ${
                isDarkMode ? 'bg-zinc-800/50 border-zinc-700/80' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex justify-between items-center border-b pb-1.5 mb-1.5 border-dashed border-slate-300 dark:border-zinc-700">
                  <span className="font-extrabold text-indigo-500 uppercase tracking-wider text-[9px]">Receipt Summary</span>
                  <span className="font-mono text-[9px] text-slate-400">Time: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <p className="font-bold flex justify-between">
                  <span>Category:</span>
                  <span className="font-black text-indigo-600 dark:text-purple-400">{formType}</span>
                </p>
                <p className="font-semibold flex justify-between">
                  <span>Guest Pin:</span>
                  <span className="font-mono">{guestName} ({roomNo})</span>
                </p>
              </div>

              <div className="pt-4 w-full">
                <button
                  onClick={handleReset}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-2xl text-sm transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span>Submit Another Request</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Live Request Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Form Type selector tabs */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-black uppercase tracking-wider ${
                  isDarkMode ? 'text-zinc-500' : 'text-slate-400'
                }`}>
                  Requested Department
                </label>
                <div className={`grid grid-cols-4 gap-1 p-1 rounded-2xl border transition-colors duration-300 ${
                  isDarkMode ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-100 border-slate-200'
                }`}>
                  {([
                    { id: 'REPAIR', label: 'Repair', icon: Wrench },
                    { id: 'HOUSEKEEPING', label: 'Towels', icon: Coffee },
                    { id: 'SERVICE', label: 'Service', icon: HelpCircle },
                    { id: 'FEEDBACK', label: 'Review', icon: Star }
                  ] as const).map((tab) => {
                    const TabIcon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setFormType(tab.id);
                          // Clear suggestions-related contents
                          setTitle('');
                        }}
                        className={`py-2 text-[10px] font-black rounded-xl text-center flex flex-col items-center gap-1 transition-all uppercase ${
                          formType === tab.id 
                            ? 'bg-indigo-100 dark:bg-zinc-800 text-indigo-600 dark:text-purple-400 shadow-sm border border-indigo-200 dark:border-zinc-700'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <TabIcon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Input fields grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={`text-[10px] font-black uppercase tracking-wider ${
                    isDarkMode ? 'text-zinc-500' : 'text-slate-400'
                  }`}>
                    Suite / Apt No
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apt 4B"
                      value={roomNo}
                      onChange={(e) => setRoomNo(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 text-xs font-bold rounded-2xl border outline-none focus:ring-1 transition-all ${
                        isDarkMode 
                          ? 'bg-zinc-950 border-zinc-800 focus:ring-purple-500 text-white focus:border-purple-500' 
                          : 'bg-slate-50 border-slate-200 focus:ring-indigo-600 text-slate-800 focus:border-indigo-600'
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={`text-[10px] font-black uppercase tracking-wider ${
                    isDarkMode ? 'text-zinc-500' : 'text-slate-400'
                  }`}>
                    Visitor Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Clara"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 text-xs font-bold rounded-2xl border outline-none focus:ring-1 transition-all ${
                        isDarkMode 
                          ? 'bg-zinc-950 border-zinc-800 focus:ring-purple-500 text-white focus:border-purple-500' 
                          : 'bg-slate-50 border-slate-200 focus:ring-indigo-600 text-slate-800 focus:border-indigo-600'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Star rating for Feedback */}
              {formType === 'FEEDBACK' && (
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-black uppercase tracking-wider text-center block ${
                    isDarkMode ? 'text-zinc-500' : 'text-slate-400'
                  }`}>
                    How would you rate your stay experience?
                  </label>
                  <div className={`flex items-center gap-2 p-3 rounded-2xl border justify-center ${
                    isDarkMode ? 'bg-zinc-950/80 border-zinc-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s)}
                        onMouseEnter={() => setHoveredRating(s)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="p-1.5 text-amber-400 font-bold hover:scale-125 transition-all"
                      >
                        <Star 
                          className={`w-7 h-7 ${
                            s <= (hoveredRating || rating) ? 'fill-current text-amber-500' : 'text-slate-300 dark:text-zinc-700'
                          }`} 
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular quick templates */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-black uppercase tracking-wider ${
                  isDarkMode ? 'text-zinc-500' : 'text-slate-400'
                }`}>
                  Quick Assistance Templates
                </label>
                <div className="flex flex-col gap-1.5">
                  {getFormSpecificSuggestions().map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setTitle(s.t);
                        setDescription(s.d);
                      }}
                      className={`text-left p-2.5 rounded-xl text-[11px] font-semibold border transition-all flex justify-between items-center text-ellipsis overflow-hidden ${
                        isDarkMode 
                          ? 'bg-zinc-950 border-zinc-800 hover:border-purple-500 hover:bg-zinc-900 text-zinc-300' 
                          : 'bg-slate-55 border-slate-100/80 hover:border-indigo-400 hover:bg-indigo-50/20 text-slate-700'
                      }`}
                    >
                      <div className="truncate max-w-[280px]">
                        <p className="font-bold truncate">{s.t}</p>
                        <p className="text-[10px] text-muted truncate mt-0.5">{s.d}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted hover:text-indigo-600 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject Input */}
              <div className="space-y-1">
                <label className={`text-[10px] font-black uppercase tracking-wider ${
                  isDarkMode ? 'text-zinc-500' : 'text-slate-400'
                }`}>
                  Ticket Heading
                </label>
                <input
                  type="text"
                  required
                  placeholder="Summarize your request briefly..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`w-full px-4 py-3 text-xs font-bold rounded-2xl border outline-none focus:ring-1 transition-all ${
                    isDarkMode 
                      ? 'bg-zinc-950 border-zinc-800 focus:ring-purple-500 text-white focus:border-purple-500' 
                      : 'bg-slate-55 border-slate-200 focus:ring-indigo-600 text-slate-800 focus:border-indigo-600'
                  }`}
                />
              </div>

              {/* Large description context */}
              <div className="space-y-1">
                <label className={`text-[10px] font-black uppercase tracking-wider ${
                  isDarkMode ? 'text-zinc-500' : 'text-slate-400'
                }`}>
                  Full details for room staff
                </label>
                <textarea
                  required
                  placeholder="Give specific details or timing requests so we can serve you better..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`w-full px-4 py-3 text-xs font-semibold rounded-2xl border outline-none focus:ring-1 transition-all min-h-[90px] ${
                    isDarkMode 
                      ? 'bg-zinc-950 border-zinc-800 focus:ring-purple-500 text-white focus:border-purple-500' 
                      : 'bg-slate-55 border-slate-200 focus:ring-indigo-600 text-slate-800 focus:border-indigo-600'
                  }`}
                />
              </div>

              {/* Priority tag selection for maintenance tasks */}
              {formType !== 'FEEDBACK' && (
                <div className={`p-3 rounded-2xl border flex justify-between items-center ${
                  isDarkMode ? 'bg-zinc-950/80 border-zinc-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[10px] font-black uppercase tracking-wider ${
                    isDarkMode ? 'text-zinc-500' : 'text-slate-400'
                  }`}>
                    Urgency Rating
                  </span>
                  <div className="flex gap-2">
                    {(['LOW', 'MEDIUM', 'HIGH'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`px-3 py-1 text-[10px] font-black tracking-wide rounded-lg uppercase transition-all ${
                          priority === p 
                            ? p === 'HIGH' 
                              ? 'bg-rose-500 text-white shadow-md' 
                              : p === 'MEDIUM' 
                              ? 'bg-amber-500 text-white shadow-md' 
                              : 'bg-neutral-500 text-white shadow-md'
                            : 'text-slate-500 hover:bg-neutral-300/30'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-4 text-white font-extrabold rounded-2xl text-xs uppercase tracking-widest transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 ${
                  isSubmitting 
                    ? 'bg-indigo-300 dark:bg-zinc-800' 
                    : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-purple-600 dark:hover:bg-purple-700 shadow-indigo-500/15'
                }`}
              >
                {isSubmitting ? (
                  <>Dispatched ticket...</>
                ) : (
                  <>
                    <span>Dispatch Support Ticket</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

            </form>
          )}

          {/* Guest's Recent Activity Ledger */}
          {recentRequests.length > 0 && (
            <div className="pt-3 border-t border-dashed border-slate-200/60 dark:border-zinc-800">
              <h4 className={`text-[10px] font-black uppercase tracking-wider mb-2.5 ${
                isDarkMode ? 'text-zinc-500' : 'text-slate-400'
              }`}>
                Your Recent Direct Requests ({recentRequests.length})
              </h4>
              <div className="space-y-2">
                {recentRequests.map((req) => (
                  <div 
                    key={req.id}
                    className={`p-3 rounded-2xl border text-xs flex justify-between items-center transition-colors duration-200 ${
                      isDarkMode ? 'bg-zinc-950 border-zinc-800/80 hover:bg-zinc-900' : 'bg-slate-50 border-slate-100 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="space-y-0.5 truncate max-w-[240px]">
                      <p className="font-bold truncate">{req.title}</p>
                      <p className="text-[10px] text-muted truncate">
                        Logged in room: {req.roomNo} • {new Date(req.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 text-[9px] font-black tracking-wider uppercase rounded-full shrink-0 ${
                      req.status === 'RESOLVED' || req.status === 'COMPLETED'
                        ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600'
                        : req.status === 'IN_PROGRESS'
                        ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600'
                        : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-500 dark:text-zinc-400'
                    }`}>
                      {req.status === 'PENDING' ? 'Queued' : req.status === 'IN_PROGRESS' ? 'W.I.P.' : 'Done'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Brand stamp footer */}
        <div className={`p-4 text-center mt-auto border-t shrink-0 ${
          isDarkMode ? 'bg-zinc-950/70 border-zinc-800 text-zinc-500' : 'bg-slate-50 border-slate-100 text-slate-400'
        }`}>
          <p className="text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-505" />
            Distributed Smart Hotel POS Network
          </p>
        </div>

      </div>
    </div>
  );
};
