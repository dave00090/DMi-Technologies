import { UserProfile, Role } from '../types';
import { getLocal, setLocal, removeLocal } from './localDb';

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
        uid: crypto.randomUUID(),
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
    
    // Add to login history
    const history = getLocal<any[]>(STORAGE_KEYS.LOGIN_HISTORY, []);
    await setLocal(STORAGE_KEYS.LOGIN_HISTORY, [{
      id: crypto.randomUUID(),
      userId: user.uid,
      userName: user.name,
      timestamp: new Date().toISOString(),
      role: user.role,
      status: 'SUCCESS'
    }, ...history].slice(0, 100));

    return user;
  },

  register: async (data: { name: string, username: string, email: string, role: Role }): Promise<UserProfile> => {
    const users = getLocal<UserProfile[]>(STORAGE_KEYS.USERS, []);
    const newUser: UserProfile = {
      uid: crypto.randomUUID(),
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
