import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotifications } from '@/contexts/NotificationContext';
import {
  LayoutDashboard, Users, Headphones, Settings,
  ClipboardList, Link2, FileText, Clock, LogOut, Menu, X, Shield, Bell,
  ChevronLeft, ChevronRight, CalendarClock, MessageSquare, SlidersHorizontal,
  ShieldCheck, GitBranch, Tv, Undo2
} from 'lucide-react';
import { SystemMessagesModal } from '@/components/SystemMessagesModal';
import FontSizeControl from '@/components/FontSizeControl';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { APP_VERSION } from 'virtual:app-version';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard', roles: ['admin', 'attendant'] },
  { label: 'Painel TV', icon: <Tv size={20} />, path: '/tv', roles: ['admin', 'attendant', 'tv'] },
  { label: 'Meus Tickets', icon: <ClipboardList size={20} />, path: '/tickets', roles: ['admin', 'user', 'attendant'] },
  { label: 'Minhas Aprovações', icon: <ShieldCheck size={20} />, path: '/approvals', roles: ['admin', 'user', 'attendant'] },
  { label: 'Administradores', icon: <Shield size={20} />, path: '/admins', roles: ['admin'] },
  { label: 'Usuários', icon: <Users size={20} />, path: '/users', roles: ['admin'] },
  { label: 'Atendentes', icon: <Headphones size={20} />, path: '/attendants', roles: ['admin'] },
  { label: 'Usuários TV', icon: <Tv size={20} />, path: '/tv-users', roles: ['admin'] },
  { label: 'Serviços', icon: <Settings size={20} />, path: '/services', roles: ['admin'] },
  { label: 'Motivos de Devolução', icon: <Undo2 size={20} />, path: '/return-reasons', roles: ['admin', 'user', 'attendant', 'tv'] },
  { label: 'Formulários', icon: <FileText size={20} />, path: '/forms', roles: ['admin'] },
  { label: 'Atendente x Serviço', icon: <Link2 size={20} />, path: '/attendant-services', roles: ['admin'] },
  { label: 'Fluxos de Aprovação', icon: <GitBranch size={20} />, path: '/approval-flows', roles: ['admin'] },
  { label: 'Expediente', icon: <Clock size={20} />, path: '/schedules', roles: ['admin'] },
  { label: 'Tickets Agendados', icon: <CalendarClock size={20} />, path: '/scheduled-tickets', roles: ['admin'] },
  { label: 'Mensagens', icon: <MessageSquare size={20} />, path: '/messages', roles: ['admin'] },
  { label: 'Logs', icon: <ClipboardList size={20} />, path: '/logs', roles: ['admin'] },
  { label: 'Configurações', icon: <SlidersHorizontal size={20} />, path: '/settings', roles: ['admin'] },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { notifications, unreadCount, clearAll, markTicketRead } = useNotifications();

  const filteredNav = navItems.filter(item => user && item.roles.includes(user.role));

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'user': return 'Usuário';
      case 'attendant': return 'Atendente';
      case 'tv': return 'Painel TV';
      default: return role;
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Mobile overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-50 gradient-sidebar text-sidebar-foreground
          transform transition-all duration-200 ease-in-out
          ${sidebarCollapsed ? 'w-16' : 'w-64'}
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
          flex flex-col
        `}>
          {/* Logo */}
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-6'} py-5 border-b border-sidebar-border`}>
            <img src="/cs-icon.jpg" alt="C&S" className="w-9 h-9 rounded-lg shrink-0 object-cover" />
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-base font-bold text-sidebar-foreground">Transporte - SGTickets</h1>
                <p className="text-[10px] text-sidebar-foreground/60">Sistema de Governança</p>
              </div>
            )}
            {!sidebarCollapsed && (
              <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground">
                <X size={20} />
              </button>
            )}
          </div>

          {/* Nav */}
          <nav className={`flex-1 overflow-y-auto py-4 ${sidebarCollapsed ? 'px-1.5' : 'px-3'} space-y-1`}>
            {filteredNav.map(item => {
              const isActive = location.pathname === item.path;
              const btn = (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                  className={`
                    w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-soft'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                    }
                  `}
                >
                  {item.icon}
                  {!sidebarCollapsed && item.label}
                </button>
              );

              if (sidebarCollapsed) {
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>{btn}</TooltipTrigger>
                    <TooltipContent side="right"><p>{item.label}</p></TooltipContent>
                  </Tooltip>
                );
              }
              return btn;
            })}
          </nav>

          {/* Collapse toggle (desktop only) */}
          <div className="hidden lg:flex justify-center border-t border-sidebar-border py-2">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {/* User */}
          <div className="border-t border-sidebar-border p-4 bg-sidebar-accent/30">
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
              <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-bold text-sidebar-foreground shrink-0">
                {user?.name.charAt(0)}
              </div>
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-sidebar-foreground truncate">{user?.name}</p>
                    <p className="text-[11px] text-sidebar-foreground/80">{getRoleLabel(user?.role || '')}</p>
                    {user?.sector && <p className="text-[10px] text-sidebar-foreground/70 truncate">🏢 {user.sector}</p>}
                    {user?.function && <p className="text-[10px] text-sidebar-foreground/70 truncate">💼 {user.function}</p>}
                    {user?.phone && <p className="text-[10px] text-sidebar-foreground/70 truncate">📞 {user.phone}</p>}
                    {user?.email && <p className="text-[10px] text-sidebar-foreground/70 truncate">📧 {user.email}</p>}
                    {user?.leaderName && <p className="text-[10px] text-sidebar-foreground/70 truncate">👤 {user.leaderName}</p>}
                  </div>
                  <button onClick={() => { logout(); navigate('/'); }} className="text-sidebar-foreground/50 hover:text-sidebar-foreground">
                    <LogOut size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Top bar */}
          <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 shadow-card">
            <div className="flex items-center min-w-0 gap-2">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden mr-1 text-muted-foreground hover:text-foreground shrink-0">
                <Menu size={22} />
              </button>
              <h2 className="text-lg font-bold text-foreground truncate">
                {filteredNav.find(n => n.path === location.pathname)?.label || 'Transporte - SGTickets'}
              </h2>
              <span className="shrink-0 text-[10px] sm:text-xs font-semibold text-muted-foreground">v{APP_VERSION}</span>
            </div>
            <FontSizeControl />
            <Popover>
              <PopoverTrigger asChild>
                <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
                  <Bell size={20} className="text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold text-foreground">Notificações</p>
                  {notifications.length > 0 && (
                    <button onClick={clearAll} className="text-xs text-primary hover:underline">Limpar tudo</button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhuma notificação</p>
                  ) : (
                    notifications.slice(0, 20).map(n => (
                      <button
                        key={n.id}
                        onClick={() => {
                          markTicketRead(n.ticketId);
                          navigate(`/tickets?openTicket=${n.ticketId}`);
                        }}
                        className={`w-full text-left px-4 py-2.5 border-b border-border last:border-0 text-xs hover:bg-muted/50 transition-colors cursor-pointer ${n.read ? 'opacity-60' : 'bg-primary/5'}`}
                      >
                        <p className="font-semibold text-foreground">{n.type === 'new_ticket' ? '🎫 Novo Ticket' : '💬 Nova Mensagem'} #{n.ticketCode}</p>
                        <p className="text-muted-foreground mt-0.5 truncate">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{new Date(n.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 sm:px-4 lg:p-6">
            <motion.div
              className="min-w-0"
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
      <SystemMessagesModal />
    </TooltipProvider>
  );
};

export default Layout;
