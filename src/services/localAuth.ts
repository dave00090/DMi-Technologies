import { v4 as uuidv4 } from 'uuid';
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
    let user = users.find(u => u.username === username);

    if (!user) {
      // Create a default admin if it's the first user or matches a specific name
      const role: Role = users.length === 0 ? 'admin' : 'staff';
      user = {
        uid: uuidv4(),
        name: username.charAt(0).toUpperCase() + username.slice(1),
        username,
        email: `${username}@dmipos.internal`,
        role,
        lastLogin: new Date().toISOString()
      };
      await setLocal(STORAGE_KEYS.USERS, [...users, user]);
    } else {
      user.lastLogin = new Date().toISOString();
      await setLocal(STORAGE_KEYS.USERS, users.map(u => u.uid === user!.uid ? user! : u));
    }

    await setLocal(STORAGE_KEYS.AUTH_USER, user);
    
    // Add to local login history
    const historyItem = {
      id: uuidv4(),
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
    const newUser: UserProfile = {
      uid: uuidv4(),
      ...data,
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
