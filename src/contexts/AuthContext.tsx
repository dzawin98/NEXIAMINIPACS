import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  permissions: string[];
  token?: string; // Password for PACS auth
  pacs_username?: string; // Optional specific username for PACS
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('pacs_user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('http://localhost:3000/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        return false;
      }

      const userData = await response.json();
      setUser(userData);
      localStorage.setItem('pacs_user', JSON.stringify(userData));
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('pacs_user');
  }, []);

  const hasPermission = useCallback((permission: string) => {
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permission.toLowerCase()) || user.role === 'Admin';
  }, [user]);

  // Session timeout logic
  const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!user) return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Throttle event listeners to avoid excessive updates
    let lastUpdate = 0;
    const throttledHandler = () => {
      const now = Date.now();
      if (now - lastUpdate > 1000) { // Update at most once per second
        handleActivity();
        lastUpdate = now;
      }
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach((event) => {
      window.addEventListener(event, throttledHandler);
    });

    // Initialize activity time
    lastActivityRef.current = Date.now();

    const checkInactivity = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT) {
        logout();
        toast({
          title: "Session Expired",
          description: "You have been logged out due to inactivity.",
          variant: "destructive",
        });
      }
    }, 10000); // Check every 10 seconds

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, throttledHandler);
      });
      clearInterval(checkInactivity);
    };
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
