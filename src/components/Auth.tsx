import React, { useState, useEffect } from 'react';
import { localAuth } from '../services/localAuth';
import { UserProfile, Role } from '../types';
import { LogIn, LogOut, User as UserIcon, Shield, Loader2, Lock, UserPlus, X } from 'lucide-react';
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
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

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
      if (isRegistering) {
        const newUser = await localAuth.register({
          username,
          name: name || 'User',
          role: loginRole,
          email: `${username.toLowerCase()}@dmitechnologies.internal`
        });
        setUser(newUser);
        onUserLoaded(newUser);
        setShowModal(false);
      } else {
        const loggedInUser = await localAuth.login(username, password);
        if (loggedInUser) {
          if (loggedInUser.role !== loginRole) {
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
              {isRegistering ? 'Create your account' : 'Sign in to your account'}
            </p>
          </div>
          
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
              <label className="text-xs font-bold text-muted uppercase">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
                <input
                  type="password"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-muted/10 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-ink"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
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
            onClick={() => setIsRegistering(!isRegistering)}
            className="w-full mt-6 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-3 py-1.5 bg-card rounded-xl border border-border shadow-sm hover:border-indigo-200 transition-all group relative">
          <div className="w-8 h-8 rounded-full bg-[#050505] flex items-center justify-center flex-shrink-0 overflow-hidden border border-border">
            <img 
              src={SYSTEM_LOGO_URL} 
              alt="Logo" 
              className="w-full h-full object-contain scale-110" 
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-bold text-ink truncate max-w-[100px]">{user.name}</p>
            <p className="text-[10px] text-muted font-bold uppercase tracking-widest">
              {user.role === 'admin' ? 'Admin' : user.role === 'hr' ? 'HR' : 'Staff'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
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
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 p-2 hover:bg-muted/20 rounded-full transition-colors"
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
                  {isRegistering ? 'Create your account' : 'Sign in to your account'}
                </p>
              </div>
              
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
                  <label className="text-xs font-bold text-muted uppercase">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
                    <input
                      type="password"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-muted/10 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-ink"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
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
                onClick={() => setIsRegistering(!isRegistering)}
                className="w-full mt-6 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
