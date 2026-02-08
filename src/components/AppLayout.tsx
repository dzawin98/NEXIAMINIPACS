import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { SidebarNav } from '@/components/SidebarNav';
import { useAuth } from '@/contexts/AuthContext';
import { useConfig } from '@/contexts/ConfigContext';

const AppLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { settings } = useConfig();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <SidebarNav />
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
        <footer className="py-2 px-6 border-t bg-card text-center text-xs text-muted-foreground">
           &copy; 2026 Nexia Technology
        </footer>
      </div>
    </div>
  );
};

export default AppLayout;
