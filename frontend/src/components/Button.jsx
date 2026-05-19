import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const Button = ({ children, className, variant = 'primary', isLoading, ...props }) => {
  const variants = {
    primary: 'btn-primary',
    secondary: 'bg-slate-800 text-white hover:bg-slate-700 px-4 py-2 rounded-lg font-medium transition-all active:scale-[0.98]',
    outline: 'border border-border text-white hover:bg-white/5 px-4 py-2 rounded-lg font-medium transition-all active:scale-[0.98]',
    ghost: 'text-secondary hover:text-white hover:bg-white/5 px-4 py-2 rounded-lg font-medium transition-all active:scale-[0.98]',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={twMerge(
        variants[variant],
        'flex items-center justify-center gap-2 relative',
        isLoading && 'opacity-70 cursor-not-allowed',
        className
      )}
      disabled={isLoading}
      {...props}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
      ) : (
        children
      )}
    </motion.button>
  );
};

export default Button;
