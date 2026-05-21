import React from 'react';
import { NavLink } from 'react-router-dom';
import { FiHome, FiMessageSquare, FiSettings, FiUsers, FiLogOut, FiPlus, FiX } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { getAvatarUrl } from '../utils/avatar';

const Sidebar = ({ mobileOpen = false, onCloseMobile = () => {} }) => {
  const { logout, user } = useAuth();

  const menuItems = [
    { icon: <FiHome />, label: 'Dashboard', path: '/dashboard' },
    { icon: <FiMessageSquare />, label: 'Meetings', path: '/meetings' },
    { icon: <FiSettings />, label: 'Settings', path: '/settings' },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={onCloseMobile}
        />
      )}
      <aside 
        className={`w-64 h-screen bg-slate-950 border-r border-white/5 flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
      <div className="px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <span className="text-[#ffffff] font-bold text-xl">R</span>
          </div>
          <span className="text-xl font-bold text-white tracking-tight">Real.Comm</span>
        </div>
        <button 
          onClick={onCloseMobile}
          className="md:hidden text-secondary hover:text-white p-2"
        >
          <FiX size={20} />
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-2">
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
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm overflow-hidden shrink-0">
            {user?.profileImage ? (
              <img src={getAvatarUrl(user.profileImage)} alt={user?.name} className="w-full h-full object-cover" />
            ) : (
              user?.name?.charAt(0) || 'U'
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-secondary truncate">
              {user?.username ? `@${user.username}` : user?.email}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-secondary hover:text-red-500 hover:bg-accent/5 transition-all"
        >
          <FiLogOut />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
