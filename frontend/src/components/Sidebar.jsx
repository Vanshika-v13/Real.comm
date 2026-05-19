import React from 'react';
import { NavLink } from 'react-router-dom';
import { FiHome, FiMessageSquare, FiSettings, FiUsers, FiLogOut, FiPlus } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { logout, user } = useAuth();

  const menuItems = [
    { icon: <FiHome />, label: 'Dashboard', path: '/dashboard' },
    { icon: <FiMessageSquare />, label: 'Meetings', path: '/join' },
    { icon: <FiUsers />, label: 'Channels', path: '/channels' },
    { icon: <FiSettings />, label: 'Settings', path: '/settings' },
  ];

  return (
    <aside className="w-64 h-screen bg-slate-950 border-r border-white/5 flex flex-col fixed left-0 top-0 z-40">
      <div className="px-6 py-8 flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-xl">R</span>
        </div>
        <span className="text-xl font-bold text-white tracking-tight">Real.Comm</span>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
              ${isActive 
                ? 'bg-primary/10 text-primary font-medium' 
                : 'text-secondary hover:text-white hover:bg-white/5'}
            `}
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl mb-4 group cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-secondary truncate">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-secondary hover:text-accent hover:bg-accent/5 transition-all"
        >
          <FiLogOut />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
