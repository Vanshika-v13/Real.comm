import React from 'react';
import { motion } from 'framer-motion';
import { FiMessageSquare, FiX } from 'react-icons/fi';

const ChatPanel = ({ onClose }) => (
  <motion.div
    initial={{ x: '100%' }}
    animate={{ x: 0 }}
    exit={{ x: '100%' }}
    className="fixed right-0 top-0 h-full w-80 bg-slate-950 border-l border-white/5 z-[60] flex flex-col shadow-2xl"
  >
    <div className="h-16 px-6 flex items-center justify-between border-b border-white/5">
      <div className="flex items-center gap-2 text-white">
        <FiMessageSquare className="text-primary" />
        <span className="font-semibold">Chat</span>
      </div>
      <button type="button" onClick={onClose} className="p-2 text-secondary hover:text-white rounded-lg hover:bg-white/5">
        <FiX />
      </button>
    </div>
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <FiMessageSquare className="w-12 h-12 text-primary/30 mb-4" />
      <p className="text-secondary text-sm">Chat is coming soon. Use voice and files to collaborate for now.</p>
    </div>
  </motion.div>
);

export default ChatPanel;
