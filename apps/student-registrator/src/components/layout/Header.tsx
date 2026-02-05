import { Icons } from '../ui/Icons';
import type { AuthUser, ThemeMode } from '../../types';

interface HeaderProps {
  user: AuthUser;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onLogout: () => void;
}

export function Header({ user, theme, onToggleTheme, onLogout }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        {/* Empty or breadcrumbs can go here */}
      </div>

      <div className="header-right">
        {/* Theme Toggle */}
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          title={theme === "light" ? "Dark mode" : "Light mode"}
        >
          {theme === "light" ? <Icons.Moon /> : <Icons.Sun />}
        </button>

        {/* User Info */}
        <div className="user-info">
          <div className="user-info-text">
            <div className="user-info-name">{user.name}</div>
            <div className="user-info-role">{user.role}</div>
          </div>
          <button className="btn-logout" onClick={onLogout} title="Chiqish">
            <Icons.LogOut />
          </button>
        </div>
      </div>
    </header>
  );
}
