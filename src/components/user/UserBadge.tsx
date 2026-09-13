'use client';

import React, { useState } from 'react';
import { User, Sparkles } from 'lucide-react';
import { useCurrentUser } from '@/lib/user';
import { UserModal } from './UserModal';

interface UserBadgeProps {
  className?: string;
  compact?: boolean;
}

export const UserBadge: React.FC<UserBadgeProps> = ({ className = '', compact = false }) => {
  const { user, isLoaded } = useCurrentUser();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!isLoaded) {
    return (
      <div className={`h-8 w-24 rounded-xl bg-neutral-200/60 dark:bg-neutral-800/60 animate-pulse ${className}`} />
    );
  }

  return (
    <>
      {user ? (
        <button
          onClick={() => setIsModalOpen(true)}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 shadow-sm hover:border-indigo-400 dark:hover:border-indigo-600 transition-all ${className}`}
          title={`Вы вошли как @${user.nickname}. Нажмите для управления профилем`}
        >
          {/* Avatar circle */}
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-extrabold text-white shadow-sm shrink-0"
            style={{ backgroundColor: user.avatarColor || '#6366f1' }}
          >
            {(user.displayName || user.nickname).slice(0, 1).toUpperCase()}
          </div>

          {!compact && (
            <div className="text-left leading-tight pr-1">
              <span className="block text-xs font-bold text-neutral-900 dark:text-neutral-100 max-w-[90px] truncate">
                {user.displayName || user.nickname}
              </span>
              <span className="block text-[10px] text-neutral-400 font-mono">
                @{user.nickname}
              </span>
            </div>
          )}
        </button>
      ) : (
        <button
          onClick={() => setIsModalOpen(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-800/80 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-semibold transition-all ${className}`}
          title="Задать никнейм для синхронизации с телефоном"
        >
          <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>{compact ? 'Войти' : 'Никнейм'}</span>
        </button>
      )}

      <UserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
