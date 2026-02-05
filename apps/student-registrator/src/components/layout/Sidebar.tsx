import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Icons } from '../ui/Icons';

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { to: '/add-students', icon: <Icons.Plus />, label: "O'quvchi qo'shish" },
    { to: '/students', icon: <Icons.Users />, label: "O'quvchilar" },
    { to: '/classes', icon: <Icons.School />, label: "Sinflar" },
    { to: '/devices', icon: <Icons.Monitor />, label: "Qurilmalar" },
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-title">
          <Icons.School />
          {!isCollapsed && <span>Student Registrator</span>}
        </div>
        <button 
          className="sidebar-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Ochish" : "Yopish"}
        >
          {isCollapsed ? <Icons.Menu /> : <Icons.X />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => 
              `sidebar-link ${isActive ? 'active' : ''}`
            }
            title={isCollapsed ? item.label : undefined}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            {!isCollapsed && <span className="sidebar-link-label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
