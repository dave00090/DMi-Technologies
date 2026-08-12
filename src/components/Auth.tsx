import React, { useState, useEffect } from 'react';
import { localAuth } from '../services/localAuth';
import { UserProfile, Role } from '../types';
import { 
  LogIn, 
  LogOut, 
  User as UserIcon, 
  Shield, 
  Loader2, 
  Lock, 
  UserPlus, 
  X, 
  Eye, 
  EyeOff, 
  KeyRound, 
  ShieldCheck, 
  ArrowLeft, 
  CheckCircle2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { SYSTEM_LOGO_URL } from '../constants';

interface AuthProps {
  onUserLoaded: (user: UserProfile | null) => void;
}

export const Auth: React.FC<AuthProps> = ({ onUserLoaded }) => {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginRole, setLoginRole] = useState<Role>('staff');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [regNationalId, setRegNationalId] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Recovery States
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryNationalId, setRecoveryNationalId] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');
  const [recoveryShowPassword, setRecoveryShowPassword] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    const currentUser = localAuth.getCurrentUser();
    setUser(currentUser);
    onUserLoaded(currentUser);
    setLoading(false);

    const handleAuthChange = () => {
      const updatedUser = localAuth.getCurrentUser();
      setUser(updatedUser);
      onUserLoaded(updatedUser);
    };

    window.addEventListener('local-auth-change', handleAuthChange);
    return () => window.removeEventListener('local-auth-change', handleAuthChange);
  }, [onUserLoaded]);

  useEffect(() => {
    if (username.toLowerCase() !== 'hr' && loginRole === 'hr') {
      setLoginRole('staff');
    }
  }, [username, loginRole]);

  const handleGoogleLogin = async () => {
    setError("Google login is not available in offline mode. Please use username/password.");
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const isReservedUser = username.trim().toUpperCase() === 'HRM' || username.trim().toUpperCase() === 'FINANCE';
      const effectiveRole: Role = isReservedUser ? 'admin' : loginRole;

      if (isRegistering) {
        const newUser = await localAuth.register({
          username,
          name: name || username.toUpperCase(),
          role: effectiveRole,
          email: `${username.toLowerCase()}@dmitechnologies.internal`,
          password,
          nationalId: regNationalId.trim()
        });
        setUser(newUser);
        onUserLoaded(newUser);
        setShowModal(false);
      } else {
        const loggedInUser = await localAuth.login(username, password);
        if (loggedInUser) {
          if (!isReservedUser && loggedInUser.role !== loginRole) {
            throw new Error(`This account is not registered as ${loginRole}`);
          }
          setUser(loggedInUser);
          onUserLoaded(loggedInUser);
          setShowModal(false);
        } else {
          throw new Error('Invalid username or password.');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoverySuccess(null);

    if (recoveryNewPassword !== recoveryConfirmPassword) {
      setRecoveryError('New passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const res = await localAuth.recoverPassword(
        recoveryUsername,
        recoveryNationalId,
        recoveryNewPassword
      );

      if (res.success) {
        setRecoverySuccess(res.message);
        setUsername(recoveryUsername);
        setPassword(recoveryNewPassword);
      } else {
        setRecoveryError(res.message);
      }
    } catch (err: any) {
      setRecoveryError(err.message || 'Recovery failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localAuth.logout();
    setUser(null);
    onUserLoaded(null);
    setShowModal(false);
  };

  if (loading && !user) {
    return (
      <div className="flex items-center justify-center p-2">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
      </div>
    );
  }

  const renderPasswordRecoveryForm = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button
          type="button"
          onClick={() => {
            setIsRecovering(false);
            setRecoveryError(null);
            setRecoverySuccess(null);
          }}
          className="p-1.5 hover:bg-muted/20 rounded-lg text-muted hover:text-ink transition-colors cursor-pointer"
          title="Back to login"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-lg font-bold text-ink">Recover Password</h3>
          <p className="text-xs text-muted">Verify your National ID Number to reset password</p>
        </div>
      </div>

      {recoverySuccess ? (
        <div className="p-5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-4 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200 leading-relaxed">{recoverySuccess}</p>
          <button
            type="button"
            onClick={() => {
              setIsRecovering(false);
              setRecoverySuccess(null);
            }}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
          >
            Log In Now
          </button>
        </div>
      ) : (
        <form onSubmit={handleRecoverPasswordSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted uppercase">Username</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
              <input
                type="text"
                required
                placeholder="Enter your account username"
                className="w-full pl-10 pr-4 py-2.5 bg-muted/10 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-ink text-sm"
                value={recoveryUsername}
                onChange={(e) => setRecoveryUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-muted uppercase">ID Number / National ID</label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
              <input
                type="text"
                required
                placeholder="Enter ID Number from Settings"
                className="w-full pl-10 pr-4 py-2.5 bg-muted/10 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-ink text-sm"
                value={recoveryNationalId}
                onChange={(e) => setRecoveryNationalId(e.target.value)}
              />
            </div>
            <p className="text-[10px] text-muted">Must match the National ID Number configured in your Settings tab.</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-muted uppercase">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
              <input
                type={recoveryShowPassword ? 'text' : 'password'}
                required
                placeholder="Enter new password"
                className="w-full pl-10 pr-10 py-2.5 bg-muted/10 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-ink text-sm"
                value={recoveryNewPassword}
                onChange={(e) => setRecoveryNewPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setRecoveryShowPassword(!recoveryShowPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1 rounded-md transition-colors cursor-pointer"
                title={recoveryShowPassword ? "Hide password" : "Show password"}
              >
                {recoveryShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-muted uppercase">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
              <input
                type={recoveryShowPassword ? 'text' : 'password'}
                required
                placeholder="Confirm new password"
                className="w-full pl-10 pr-10 py-2.5 bg-muted/10 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-ink text-sm"
                value={recoveryConfirmPassword}
                onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {recoveryError && <p className="text-xs text-rose-500 font-medium leading-relaxed">{recoveryError}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            <span>Verify ID & Reset Password</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsRecovering(false);
              setRecoveryError(null);
            }}
            className="w-full py-2 text-xs font-bold text-muted hover:text-ink transition-colors cursor-pointer"
          >
            Cancel & Return to Login
          </button>
        </form>
      )}
    </div>
  );

  return (
    <>
      {!user ? (
        <div className="bg-card rounded-3xl w-full max-w-md shadow-2xl p-8 relative border border-border">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden border border-border shadow-sm">
              <img 
                src={SYSTEM_LOGO_URL} 
                alt="Logo" 
                className="w-full h-full object-contain p-2" 
                onError={(e) => {
                  e.currentTarget.src = "https://cdn-icons-png.flaticon.com/512/1055/1055644.png";
                }}
                referrerPolicy="no-referrer"
              />
            </div>
            <h2 className="text-2xl font-bold text-ink">Welcome to DMi Technologies</h2>
            <p className="text-muted text-sm mt-1">
              {isRecovering ? 'Password Recovery' : isRegistering ? 'Create your account' : 'Sign in to your account'}
            </p>
          </div>
          
          {isRecovering ? (
            renderPasswordRecoveryForm()
          ) : (
            <>
              <div className="flex bg-muted/20 p-1 rounded-xl mb-8">
                <button
                  onClick={() => setLoginRole('staff')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${loginRole === 'staff' ? 'bg-card text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-muted'}`}
                >
                  Staff
                </button>
                {username.toLowerCase() === 'hr' && (
                  <button
                    onClick={() => setLoginRole('hr')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${loginRole === 'hr' ? 'bg-card text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-muted'}`}
                  >
                    HR
                  </button>
                )}
                <button
                  onClick={() => setLoginRole('admin')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${loginRole === 'admin' ? 'bg-card text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-muted'}`}
                >
                  Admin
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {isRegistering && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted uppercase">Full Name</label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
                        <input
                          type="text"
                          required
                          className="w-full pl-10 pr-4 py-2.5 bg-muted/10 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-ink"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted uppercase">National ID / ID Number (Optional)</label>
                      <div className="relative">
                        <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
                        <input
                          type="text"
                          placeholder="Enter National ID"
                          className="w-full pl-10 pr-4 py-2.5 bg-muted/10 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-ink"
                          value={regNationalId}
                          onChange={(e) => setRegNationalId(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted uppercase">Username</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
                    <input
                      type="text"
                      required
                      placeholder="Enter username"
                      className="w-full pl-10 pr-4 py-2.5 bg-muted/10 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-ink"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-muted uppercase">Password</label>
                    {!isRegistering && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsRecovering(true);
                          setError(null);
                          setRecoveryUsername(username);
                        }}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter password"
                      className="w-full pl-10 pr-10 py-2.5 bg-muted/10 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-ink"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1 rounded-md transition-colors cursor-pointer"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRegistering ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />)}
                  {isRegistering ? 'Create Account' : `Login as ${loginRole}`}
                </button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted font-bold">Secure Access</span>
                </div>
              </div>

              <div className="text-center text-[10px] font-bold text-muted uppercase tracking-widest opacity-50">
                SYSTEM BY DMi TECHNOLOGIES
              </div>
              
              <button
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError(null);
                }}
                className="w-full mt-6 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 px-3 py-1.5 bg-card rounded-xl border border-border shadow-sm hover:border-indigo-200 transition-all group relative">
          <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center flex-shrink-0 border border-indigo-100 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-extrabold text-sm uppercase">
            {user.name ? user.name.trim()[0] : <UserIcon className="w-4 h-4" />}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-bold text-ink truncate max-w-[100px]">{user.name}</p>
            <p className="text-[10px] text-muted font-bold uppercase tracking-widest">
              {user.role === 'admin' ? 'Admin' : user.role === 'hr' ? 'HR' : 'Staff'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card rounded-3xl w-full max-w-md shadow-2xl p-8 relative border border-border"
            >
              <button 
                onClick={() => {
                  setShowModal(false);
                  setIsRecovering(false);
                }}
                className="absolute top-4 right-4 p-2 hover:bg-muted/20 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-muted" />
              </button>

              <div className="text-center mb-8">
                <div className="w-24 h-24 bg-[#050505] rounded-3xl flex items-center justify-center mx-auto mb-6 overflow-hidden border border-border shadow-xl">
                  <img 
                    src={SYSTEM_LOGO_URL} 
                    alt="Logo" 
                    className="w-full h-full object-contain scale-110" 
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h2 className="text-2xl font-bold text-ink">Welcome to DMi Technologies</h2>
                <p className="text-muted text-sm mt-1">
                  {isRecovering ? 'Password Recovery' : isRegistering ? 'Create your account' : 'Sign in to your account'}
                </p>
              </div>
              
              {isRecovering ? (
                renderPasswordRecoveryForm()
              ) : (
                <>
                  <div className="flex bg-muted/20 p-1 rounded-xl mb-8">
                    <button
                      onClick={() => setLoginRole('staff')}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${loginRole === 'staff' ? 'bg-card text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-muted'}`}
                    >
                      Staff
                    </button>
                    {username.toLowerCase() === 'hr' && (
                      <button
                        onClick={() => setLoginRole('hr')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${loginRole === 'hr' ? 'bg-card text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-muted'}`}
                      >
                        HR
                      </button>
                    )}
                    <button
                      onClick={() => setLoginRole('admin')}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${loginRole === 'admin' ? 'bg-card text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-muted'}`}
                    >
                      Admin
                    </button>
                  </div>

                  <form onSubmit={handleAuth} className="space-y-4">
                    {isRegistering && (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-muted uppercase">Full Name</label>
                          <div className="relative">
                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
                            <input
                              type="text"
                              required
                              className="w-full pl-10 pr-4 py-2.5 bg-muted/10 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-ink"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-muted uppercase">National ID / ID Number (Optional)</label>
                          <div className="relative">
                            <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
                            <input
                              type="text"
                              placeholder="Enter National ID"
                              className="w-full pl-10 pr-4 py-2.5 bg-muted/10 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-ink"
                              value={regNationalId}
                              onChange={(e) => setRegNationalId(e.target.value)}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted uppercase">Username</label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
                        <input
                          type="text"
                          required
                          placeholder="Enter username"
                          className="w-full pl-10 pr-4 py-2.5 bg-muted/10 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-ink"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-muted uppercase">Password</label>
                        {!isRegistering && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsRecovering(true);
                              setError(null);
                              setRecoveryUsername(username);
                            }}
                            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            Forgot Password?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Enter password"
                          className="w-full pl-10 pr-10 py-2.5 bg-muted/10 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-ink"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1 rounded-md transition-colors cursor-pointer"
                          title={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRegistering ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />)}
                      {isRegistering ? 'Create Account' : `Login as ${loginRole}`}
                    </button>
                  </form>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted font-bold">Secure Access</span>
                    </div>
                  </div>

                  <div className="text-center text-[10px] font-bold text-muted uppercase tracking-widest opacity-50">
                    SYSTEM BY DMi TECHNOLOGIES
                  </div>
                  
                  <button
                    onClick={() => {
                      setIsRegistering(!isRegistering);
                      setError(null);
                    }}
                    className="w-full mt-6 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

