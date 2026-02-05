import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import type { AuthUser, ThemeMode } from '../../types';

interface LayoutProps {
  user: AuthUser;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onLogout: () => void;
  children: ReactNode;
}

export function Layout({ user, theme, onToggleTheme, onLogout, children }: LayoutProps) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-container">
        <Header 
          user={user} 
          theme={theme} 
          onToggleTheme={onToggleTheme} 
          onLogout={onLogout} 
        />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
