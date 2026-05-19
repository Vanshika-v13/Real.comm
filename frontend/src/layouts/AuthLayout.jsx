import React from 'react';
import { motion } from 'framer-motion';

const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px] animate-pulse-slow"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
            Real<span className="text-primary text-5xl">.</span>Comm
          </h1>
          <p className="text-secondary">{subtitle}</p>
        </div>

        <div className="glass-panel p-8 rounded-2xl shadow-2xl relative z-10 border-white/10">
          <h2 className="text-2xl font-semibold text-white mb-6">{title}</h2>
          {children}
        </div>
      </motion.div>
    </div>
  );
};

export default AuthLayout;
