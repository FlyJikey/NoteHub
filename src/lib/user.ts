'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '@/types';

const STORAGE_KEY = 'notehub_current_user';
const EVENT_NAME = 'notehub_user_changed';

export function getStoredUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch (e) {
    return null;
  }
}

export function setStoredUser(user: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    // Set cookie for 1 year
    document.cookie = `notehub_user=${encodeURIComponent(user.nickname)}; path=/; max-age=31536000; SameSite=Lax`;
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: user }));
  } catch (e) {
    console.error('Failed to store user:', e);
  }
}

export function clearStoredUser(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    document.cookie = 'notehub_user=; path=/; max-age=0; SameSite=Lax';
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: null }));
  } catch (e) {
    console.error('Failed to clear user:', e);
  }
}

export function useCurrentUser() {
  const [user, setUserState] = useState<UserProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const initial = getStoredUser();
    setUserState(initial);
    setIsLoaded(true);

    const handleUserChanged = (e: Event) => {
      const custom = e as CustomEvent<UserProfile | null>;
      setUserState(custom.detail);
    };

    window.addEventListener(EVENT_NAME, handleUserChanged);
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        setUserState(getStoredUser());
      }
    });

    return () => {
      window.removeEventListener(EVENT_NAME, handleUserChanged);
    };
  }, []);

  const setUser = useCallback((newUser: UserProfile) => {
    setStoredUser(newUser);
    setUserState(newUser);
  }, []);

  const logout = useCallback(() => {
    clearStoredUser();
    setUserState(null);
  }, []);

  return { user, setUser, logout, isLoaded };
}
