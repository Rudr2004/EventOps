import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

type BadgeTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <motion.span
      key={tone}
      className={`badge badge-${tone}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18 }}
    >
      {children}
    </motion.span>
  );
}
