import React from 'react';
import { twMerge } from 'tailwind-merge';

const Input = ({ label, error, className, ...props }) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-slate-300 ml-1">
          {label}
        </label>
      )}
      <input
        className={twMerge(
          'input-field',
          error && 'border-accent focus:ring-accent/20 focus:border-accent',
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-xs text-accent mt-1 ml-1">{error}</p>
      )}
    </div>
  );
};

export default Input;
