/**
 * Servicio de almacenamiento simple usando localStorage (web) o memoria (nativo)
 * TODO: Instalar @react-native-async-storage/async-storage para persistencia en nativo
 */

// Almacenamiento temporal en memoria para desarrollo
const memoryStorage: { [key: string]: string } = {};

export const storage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      } else {
        memoryStorage[key] = value;
      }
    } catch (error) {
      console.error('Error saving to storage:', error);
      memoryStorage[key] = value;
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      } else {
        return memoryStorage[key] || null;
      }
    } catch (error) {
      console.error('Error reading from storage:', error);
      return memoryStorage[key] || null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      } else {
        delete memoryStorage[key];
      }
    } catch (error) {
      console.error('Error removing from storage:', error);
      delete memoryStorage[key];
    }
  },

  async clear(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      } else {
        Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]);
      }
    } catch (error) {
      console.error('Error clearing storage:', error);
      Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]);
    }
  }
};

// Funciones auxiliares para token y usuario
export const getToken = async (): Promise<string | null> => {
  return await storage.getItem('auth_token');
};

export const setToken = async (token: string): Promise<void> => {
  await storage.setItem('auth_token', token);
};

export const getUserData = async (): Promise<any | null> => {
  const userData = await storage.getItem('user_data');
  return userData ? JSON.parse(userData) : null;
};

export const setUserData = async (data: any): Promise<void> => {
  await storage.setItem('user_data', JSON.stringify(data));
};

export const getDarkMode = async (): Promise<boolean> => {
  const mode = await storage.getItem('dark_mode');
  return mode === 'true';
};

export const setDarkMode = async (isDark: boolean): Promise<void> => {
  await storage.setItem('dark_mode', isDark.toString());
};

export const clearAll = async (): Promise<void> => {
  await storage.clear();
};
