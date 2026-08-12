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
    const users = getLocal<UserProfile[]>(STORAGE_KEYS.USERS, []);
    let user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

    const isReserved = username.trim().toUpperCase() === 'HRM' || username.trim().toUpperCase() === 'FINANCE';

    if (!user) {
      // Create a default user if not found
      const role: Role = (isReserved || users.length === 0) ? 'admin' : 'staff';
      user = {
        uid: crypto.randomUUID(),
        name: username.toUpperCase(),
        username,
        email: `${username}@dmipos.internal`,
        role,
        password,
        lastLogin: new Date().toISOString()
      };
      await setLocal(STORAGE_KEYS.USERS, [...users, user]);
    } else {
      // Verify password if set
      if (user.password && password && user.password !== password) {
        throw new Error('Invalid username or password.');
      }
      
      // Set initial password if legacy account
      if (!user.password && password) {
        user.password = password;
      }

      if (isReserved) {
        user.role = 'admin'; // Ensure reserved accounts have full access like admin
      }
      user.lastLogin = new Date().toISOString();
      await setLocal(STORAGE_KEYS.USERS, users.map(u => u.uid === user!.uid ? user! : u));
    }

    await setLocal(STORAGE_KEYS.AUTH_USER, user);
    window.dispatchEvent(new Event('local-auth-change'));
    
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

  register: async (data: { name: string, username: string, email: string, role: Role, password?: string, nationalId?: string }): Promise<UserProfile> => {
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
    window.dispatchEvent(new Event('local-auth-change'));
  },

  updateUser: async (uid: string, updates: Partial<UserProfile>): Promise<void> => {
    const users = getLocal<UserProfile[]>(STORAGE_KEYS.USERS, []);
    const updated = users.map(u => u.uid === uid ? { ...u, ...updates } : u);
    await setLocal(STORAGE_KEYS.USERS, updated);
    
    const currentUser = localAuth.getCurrentUser();
    if (currentUser && currentUser.uid === uid) {
      await setLocal(STORAGE_KEYS.AUTH_USER, { ...currentUser, ...updates });
      window.dispatchEvent(new Event('local-auth-change'));
    }
  },

  recoverPassword: async (username: string, nationalId: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const cleanUsername = username.trim().toLowerCase();
    const cleanId = nationalId.trim().toUpperCase();

    if (!cleanUsername || !cleanId || !newPassword) {
      return { success: false, message: 'Please fill in all required fields.' };
    }

    const users = getLocal<UserProfile[]>(STORAGE_KEYS.USERS, []);
    let user = users.find(u => u.username.toLowerCase() === cleanUsername);

    if (!user) {
      return { success: false, message: `Account with username "${username}" was not found.` };
    }

    // Check ID Number on UserProfile
    let userNationalId = user.nationalId ? user.nationalId.trim().toUpperCase() : '';

    // Fallback: check Employee list for matching ID Number
    if (!userNationalId) {
      const employees = getLocal<any[]>('dmi_pos_employees', []);
      const matchingEmp = employees.find(e => 
        e.nationalId && 
        (e.name?.toLowerCase() === user?.name?.toLowerCase() || 
         e.email?.toLowerCase() === user?.email?.toLowerCase() ||
         e.name?.toLowerCase().includes(user?.username?.toLowerCase()))
      );
      if (matchingEmp && matchingEmp.nationalId) {
        userNationalId = matchingEmp.nationalId.trim().toUpperCase();
      }
    }

    if (!userNationalId) {
      return { 
        success: false, 
        message: 'No ID Number is configured for this account. Please log in or ask an administrator to set your ID Number in the Settings tab.' 
      };
    }

    if (userNationalId !== cleanId) {
      return { 
        success: false, 
        message: 'ID Number does not match the registered ID Number in Settings for this account.' 
      };
    }

    // Update password
    user.password = newPassword;
    user.nationalId = userNationalId; // store on user profile as well

    await setLocal(STORAGE_KEYS.USERS, users.map(u => u.uid === user!.uid ? user! : u));

    const currentUser = localAuth.getCurrentUser();
    if (currentUser && currentUser.uid === user.uid) {
      await setLocal(STORAGE_KEYS.AUTH_USER, user);
      window.dispatchEvent(new Event('local-auth-change'));
    }

    return { success: true, message: 'Password recovered successfully! You can now log in with your new password.' };
  }
};
