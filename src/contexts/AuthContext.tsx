import React, { createContext, useContext, useState, useCallback } from 'react';

interface User {
  username: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('pacs_user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    // Mock authentication - replace with actual Orthanc/LDAP auth
    if (username && password) {
      const mockUser: User = {
        username,
        name: username.charAt(0).toUpperCase() + username.slice(1),
        role: 'Radiologist',
      };
      setUser(mockUser);
      localStorage.setItem('pacs_user', JSON.stringify(mockUser));
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('pacs_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
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
