import React from 'react';
import { motion } from 'framer-motion';

function getThemeClass(theme) {
  switch (theme) {
    case 'chrome': return 'theme-chrome';
    case 'rainbow': return 'theme-rainbow';
    case 'pink': return 'theme-pink';
    case 'neon': return 'theme-neon';
    default: return 'theme-minimal';
  }
}

export default function ProgressBar({ progress = 0, theme = 'minimal', animate = true }) {
  const isIndeterminate = progress < 0;

  return (
    <div className="w-full h-1.5 bg-border-soft rounded-full overflow-hidden">
      {isIndeterminate ? (
        <motion.div
          className={`h-full rounded-full ${getThemeClass(theme)}`}
          initial={{ x: '-100%', width: '40%' }}
          animate={{ x: '250%' }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <motion.div
          className={`h-full rounded-full ${getThemeClass(theme)}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          transition={{ duration: animate ? 0.3 : 0 }}
        />
      )}
    </div>
  );
}
