'use client';

import React, { useState, useEffect } from 'react';
import { Board, Role } from '@/types';
import { X, Copy, Check, Share2, Shield, Eye, Edit3 } from 'lucide-react';

interface ShareModalProps {
  board: Board;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  board,
  isOpen,
  onClose,
}) => {
  const [role, setRole] = useState<Role>('editor');
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  if (!isOpen) return null;

  const shareUrl = `${origin}/board/${board.id}?role=${role}&token=${board.shareToken}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                Поделиться столом
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Дайте доступ напарнику или клиенту по ссылке
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            Уровень доступа по ссылке
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setRole('editor')}
              className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                role === 'editor'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                  : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
              }`}
            >
              <Edit3 className="w-4 h-4 text-indigo-500" />
              <div className="text-left">
                <span className="block font-bold">Редактор</span>
                <span className="text-[10px] text-neutral-500 font-normal">
                  Может менять и рисовать
                </span>
              </div>
            </button>

            <button
              onClick={() => setRole('viewer')}
              className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                role === 'viewer'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                  : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
              }`}
            >
              <Eye className="w-4 h-4 text-sky-500" />
              <div className="text-left">
                <span className="block font-bold">Читатель</span>
                <span className="text-[10px] text-neutral-500 font-normal">
                  Только просмотр стола
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Link input with Copy button */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            Ссылка для присоединения
          </label>
          <div className="flex items-center gap-2 p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-transparent px-2.5 text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none select-all font-mono"
            />
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  Скопировано!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Копировать
                </>
              )}
            </button>
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-500 dark:text-neutral-400">
          <Shield className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <span>
            Каждая ссылка защищена персональным токеном безопасности. Вы можете в любой момент изменить роль или закрыть доступ.
          </span>
        </div>
      </div>
    </div>
  );
};
