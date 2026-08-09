import { UserProfile, Role } from '../types';
import { getLocal, setLocal, removeLocal } from './localDb';
import { supabase } from './masterService';

const STORAGE_KEYS = {
  USERS: 'dmi_pos_users',
  AUTH_USER: 'dmi_pos_auth_user',
  LOGIN_HISTORY: 'dmi_pos_login_history'
};

export const localAuth = {
  getCurrentUser: (): UserProfile | null => {
    return getLocal<UserProfile | null>(STORAGE_KEYS.AUTH_USER, null);
  },

  login: async (username: string, password: string): Promise<UserProfile> => {
    // In a real local app, we'd check against a stored users list
    // For this demo, we'll allow any login and create a user if not exists
    const users = getLocal<UserProfile[]>(STORAGE_KEYS.USERS, []);
    let user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

    const isReserved = username.trim().toUpperCase() === 'HRM' || username.trim().toUpperCase() === 'FINANCE';

    if (!user) {
      // Create a default admin if it's reserved, the first user, or matches a specific name
      const role: Role = (isReserved || users.length === 0) ? 'admin' : 'staff';
      user = {
        uid: crypto.randomUUID(),
        name: username.toUpperCase(),
        username,
        email: `${username}@dmipos.internal`,
        role,
        lastLogin: new Date().toISOString()
      };
      await setLocal(STORAGE_KEYS.USERS, [...users, user]);
    } else {
      if (isReserved) {
        user.role = 'admin'; // Ensure reserved accounts have full access like admin
      }
      user.lastLogin = new Date().toISOString();
      await setLocal(STORAGE_KEYS.USERS, users.map(u => u.uid === user!.uid ? user! : u));
    }

    await setLocal(STORAGE_KEYS.AUTH_USER, user);
    
    // Add to local login history
    const historyItem = {
      id: crypto.randomUUID(),
      userId: user.uid,
      userName: user.name,
      timestamp: new Date().toISOString(),
      role: user.role,
      status: 'SUCCESS'
    };
    
    const history = getLocal<any[]>(STORAGE_KEYS.LOGIN_HISTORY, []);
    await setLocal(STORAGE_KEYS.LOGIN_HISTORY, [historyItem, ...history].slice(0, 100));

    // Sync to Supabase for Master Admin visibility
    try {
      await supabase.from('login_history').insert(historyItem);
    } catch (e) {
      console.warn('Failed to sync login to cloud (offline mode)', e);
    }

    return user;
  },

  register: async (data: { name: string, username: string, email: string, role: Role }): Promise<UserProfile> => {
    const users = getLocal<UserProfile[]>(STORAGE_KEYS.USERS, []);
    const isReserved = data.username.trim().toUpperCase() === 'HRM' || data.username.trim().toUpperCase() === 'FINANCE';
    const newUser: UserProfile = {
      uid: crypto.randomUUID(),
      ...data,
      role: isReserved ? 'admin' : data.role,
      lastLogin: new Date().toISOString()
    };
    await setLocal(STORAGE_KEYS.USERS, [...users, newUser]);
    return newUser;
  },

  logout: async (): Promise<void> => {
    await removeLocal(STORAGE_KEYS.AUTH_USER);
  },

  updateUser: async (uid: string, updates: Partial<UserProfile>): Promise<void> => {
    const users = getLocal<UserProfile[]>(STORAGE_KEYS.USERS, []);
    const updated = users.map(u => u.uid === uid ? { ...u, ...updates } : u);
    await setLocal(STORAGE_KEYS.USERS, updated);
    
    const currentUser = localAuth.getCurrentUser();
    if (currentUser && currentUser.uid === uid) {
      await setLocal(STORAGE_KEYS.AUTH_USER, { ...currentUser, ...updates });
    }
  }
};
