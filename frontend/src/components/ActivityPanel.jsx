import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiActivity, FiX, FiUserPlus, FiUserMinus, FiTv, FiFilePlus } from 'react-icons/fi';
import { getAvatarUrl } from '../utils/avatar';

const getActivityIcon = (type) => {
  switch (type) {
    case 'join':
      return <FiUserPlus className="text-emerald-400" />;
    case 'leave':
      return <FiUserMinus className="text-rose-400" />;
    case 'screenshare':
      return <FiTv className="text-blue-400" />;
    case 'file':
      return <FiFilePlus className="text-purple-400" />;
    default:
      return <FiActivity className="text-primary" />;
  }
};

const formatTime = (isoString) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (e) {
    return 'Just now';
  }
};

const ActivityPanel = ({ activities, onClose }) => {
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 h-full w-80 bg-slate-950 border-l border-white/5 z-[60] flex flex-col shadow-2xl"
    >
      <div className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-slate-900/50">
        <div className="flex items-center gap-2 text-white">
          <FiActivity className="text-primary" />
          <span className="text-sm font-semibold">Activity Log</span>
          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full text-secondary">
            {activities.length}
          </span>
        </div>
        <button onClick={onClose} className="p-2 text-secondary hover:text-white transition-colors">
          <FiX />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
        <AnimatePresence initial={false}>
          {activities.map((activity) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all flex items-start gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-md shrink-0">
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    {activity.user?.profileImage ? (
                      <img src={getAvatarUrl(activity.user.profileImage)} alt={activity.user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[8px] font-bold text-white">
                        {activity.user?.name?.charAt(0) || 'U'}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-white truncate">
                    {activity.user?.fullName || activity.user?.name || 'User'}
                  </span>
                </div>
                
                {activity.user?.username && (
                  <p className="text-[10px] text-secondary font-light mt-0.5">
                    @{activity.user.username}
                  </p>
                )}

                <p className="text-xs text-secondary mt-1 font-light leading-relaxed">
                  {activity.action}
                </p>
                
                <span className="text-[9px] text-secondary/40 font-light mt-1.5 block">
                  {formatTime(activity.timestamp)}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {activities.length === 0 && (
          <div className="py-24 flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
              <FiActivity className="w-6 h-6 text-white/10" />
            </div>
            <p className="text-xs text-secondary">No activity logged yet.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ActivityPanel;
