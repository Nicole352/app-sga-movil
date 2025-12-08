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
