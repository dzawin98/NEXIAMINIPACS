import React, { createContext, useContext, useEffect, useState } from 'react';
import { config as defaultConfig } from '@/lib/config';

interface AppSettings {
  institution_name: string;
}

interface ConfigContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  isLoading: boolean;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>({
    institution_name: defaultConfig.app.institution
  });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Fetch from backend API
        // Note: apiBaseUrl is '/pacs', so this hits '/pacs/settings' 
        // which Vite proxies to 'http://localhost:3000/api/settings'
        const response = await fetch(`${defaultConfig.apiBaseUrl}/settings`);
        if (response.ok) {
          const data = await response.json();
          if (data.institution_name) {
            setSettings(prev => ({ ...prev, institution_name: data.institution_name }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      // Optimistic update
      setSettings(prev => ({ ...prev, ...newSettings }));
      
      const response = await fetch(`${defaultConfig.apiBaseUrl}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }
    } catch (error) {
      console.error('Update settings failed:', error);
      // Revert on failure could be implemented here
      throw error;
    }
  };

  return (
    <ConfigContext.Provider value={{ settings, updateSettings, isLoading }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
