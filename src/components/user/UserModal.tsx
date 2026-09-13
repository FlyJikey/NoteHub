'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, KeyRound, Check, ArrowRight, ShieldCheck, Sparkles, LogOut } from 'lucide-react';
import { UserProfile } from '@/types';
import { useCurrentUser } from '@/lib/user';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserSet?: (user: UserProfile) => void;
}

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  onUserSet,
}) => {
  const { user, setUser, logout } = useCurrentUser();

  const [mounted, setMounted] = useState(false);
  const [nickname, setNickname] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'enter_nickname' | 'enter_pin'>('enter_nickname');
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (user) {
        setNickname(user.nickname);
        setDisplayName(user.displayName);
      } else {
        setNickname('');
        setDisplayName('');
      }
      setPin('');
      setStep('enter_nickname');
      setError('');
      setIsExistingUser(false);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleCheckNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNick = nickname.trim().toLowerCase();
    if (!cleanNick) {
      setError('Пожалуйста, введите никнейм');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/users/auth?nickname=${encodeURIComponent(cleanNick)}`);
      const data = await res.json();

      if (data.exists) {
        setIsExistingUser(true);
        if (data.displayName) setDisplayName(data.displayName);
        setStep('enter_pin');
      } else {
        // New user
        setIsExistingUser(false);
        setStep('enter_pin');
      }
    } catch (err) {
      setError('Ошибка проверки ника. Попробуйте еще раз.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/users/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          displayName: displayName.trim() || nickname.trim(),
          pin: pin.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Ошибка входа');
        setLoading(false);
        return;
      }

      setUser(data.user);
      if (onUserSet) onUserSet(data.user);
      onClose();
    } catch (err) {
      setError('Сетевая ошибка при аутентификации');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setNickname('');
    setDisplayName('');
    setPin('');
    setStep('enter_nickname');
    onClose();
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-md my-auto rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-amber-500 flex items-center justify-center text-white shadow-md">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                {user ? 'Ваш профиль в NoteHub' : 'Вход по никнейму'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {user ? `@${user.nickname} • один аккаунт на всех устройствах` : 'Для синхронизации заметок с телефона и ПК'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-600 dark:text-rose-400 font-medium">
            {error}
          </div>
        )}

        {/* Form view */}
        {step === 'enter_nickname' ? (
          <form onSubmit={handleCheckNickname} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Никнейм *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm font-medium">
                  @
                </span>
                <input
                  type="text"
                  required
                  autoFocus
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  placeholder="например: danil"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Используйте один и тот же ник на ПК и телефоне, чтобы работать вместе.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              {user ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-600 font-semibold p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Выйти из профиля</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="submit"
                disabled={loading || !nickname.trim()}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
              >
                <span>{loading ? 'Проверка...' : 'Далее'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleAuthenticate} className="space-y-4">
            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-indigo-950 dark:text-indigo-200">@{nickname}</span>
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
                  {isExistingUser ? 'Существующий аккаунт' : 'Новый профиль'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('enter_nickname');
                  setError('');
                }}
                className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline"
              >
                Изменить
              </button>
            </div>

            {/* Display Name (optional) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Отображаемое имя (как обращаться)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={nickname}
                className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* PIN Code */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                  {isExistingUser ? 'PIN-код для входа *' : '4-значный PIN-код (для защиты)'}
                </span>
                <span className="text-[10px] text-neutral-400 font-normal">
                  {isExistingUser ? 'Обязательно' : 'Рекомендуется'}
                </span>
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required={isExistingUser}
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full tracking-widest text-center px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-base font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {isExistingUser
                  ? 'Введите PIN, который вы задавали на другом устройстве.'
                  : 'Запомните этот PIN — он потребуется при входе с телефона или другого ПК.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('enter_nickname')}
                className="px-4 py-2 text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                Назад
              </button>
              <button
                type="submit"
                disabled={loading || (isExistingUser && !pin)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{loading ? 'Сохранение...' : isExistingUser ? 'Войти' : 'Создать и войти'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Security / Privacy badge */}
        <div className="flex items-start gap-2 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-500 dark:text-neutral-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <span>
            Профиль привязывается к вашим заметкам. Вы сможете бесшовно продолжать работу с любых устройств по вашему нику и PIN.
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
};
