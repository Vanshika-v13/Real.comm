import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <motion.div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className={`px-4 py-3 rounded-xl text-sm font-medium shadow-lg border pointer-events-auto ${
                t.type === 'error'
                  ? 'bg-accent/20 border-accent/30 text-accent'
                  : t.type === 'success'
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-900 border-white/10 text-white'
              }`}
            >
              {typeof t.message === 'object' && t.message !== null ? (
                <div className="flex flex-col gap-0.5">
                  {t.message.title && <div className="font-semibold text-white">{t.message.title}</div>}
                  {t.message.description && <div className="text-xs text-secondary leading-relaxed font-light">{t.message.description}</div>}
                </div>
              ) : (
                t.message
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </ToastContext.Provider>
  );
};
