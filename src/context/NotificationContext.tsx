import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { AppState } from 'react-native';
import { getUnreadCount } from '../api';
import { useAuth } from './AuthContext';

interface NotificationContextValue {
  unreadCount: number;
  refreshCount: () => void;
  clearCount: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  refreshCount: () => {},
  clearCount: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const appState = useRef(AppState.currentState);

  const refreshCount = useCallback(() => {
    if (!user) return;
    getUnreadCount().then(setUnreadCount).catch(() => {});
  }, [user]);

  const clearCount = useCallback(() => setUnreadCount(0), []);

  // 登入後立即拉一次
  useEffect(() => {
    if (user) refreshCount();
  }, [user]);

  // App 從背景回到前景時更新
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        refreshCount();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [refreshCount]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshCount, clearCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
