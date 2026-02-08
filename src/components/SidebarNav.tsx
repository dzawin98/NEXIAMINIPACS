import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { config } from '@/lib/config';
import { cn } from '@/lib/utils';
import { LayoutDashboard, List, Settings, ChevronLeft, ChevronRight, Fingerprint } from 'lucide-react';

export const SidebarNav: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved) setCollapsed(saved === 'true');
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebarCollapsed', String(next));
  };

  const Item = ({ to, label, icon: Icon }: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }) => {
    const active = location.pathname === to;
    return (
      <Link
        to={to}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-md text-sm',
          active ? 'bg-secondary text-secondary-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
      >
        <Icon className="h-4 w-4" />
        {!collapsed && <span>{label}</span>}
      </Link>
    );
  };

  return (
    <aside className={cn('shrink-0 border-r bg-card transition-all duration-200', collapsed ? 'w-16' : 'w-64')}>
      <div className="px-4 py-6 border-b">
        <div className={cn('flex items-center', collapsed ? 'flex-col gap-2' : 'relative justify-center')}>
          <div className={cn('flex items-center justify-center transition-all', collapsed ? 'h-8 w-8' : 'h-10 w-auto max-w-[120px]')}>
            <img src="/logo.png" alt="Logo" className="h-full w-auto object-contain" />
          </div>
          <button
            type="button"
            aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
            onClick={toggleCollapsed}
            className={cn(
              "inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted text-muted-foreground transition-all",
              !collapsed && "absolute right-0 top-1/2 -translate-y-1/2"
            )}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <nav className={cn('p-2 space-y-1', collapsed ? 'flex flex-col items-center' : '')}>
        <Item to="/dashboard" label="Dashboard" icon={LayoutDashboard} />
        <Item to="/worklist" label="Worklist" icon={List} />
        {user?.role?.toLowerCase() === 'admin' && <Item to="/settings" label="Settings" icon={Settings} />}
        {user?.username === 'superadmin' && <Item to="/identity" label="Identitas" icon={Fingerprint} />}
      </nav>
    </aside>
  );
};
