import React, { createContext, useContext } from 'react';
import { useNotificationBell, NotificationItem } from '@/hooks/useNotificationBell';

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  ticketsWithNewMessages: Set<string>;
  markTicketRead: (ticketId: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useNotificationBell();
  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};
