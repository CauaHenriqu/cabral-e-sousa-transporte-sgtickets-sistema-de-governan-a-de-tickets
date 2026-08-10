import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logAction } from '@/lib/logAction';
import type { User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'user' | 'attendant' | 'tv';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  sector: string;
  function: string;
  phone: string;
  leaderName: string;
  firstLogin: boolean;
  status: string;
  canCloseTickets: boolean;
  canTransferTickets: boolean;
  canChangeReturnReason: boolean;
  receivesNewTickets: boolean;
  canReopenTickets: boolean;

}

interface AuthContextType {
  user: AuthUser | null;
  supabaseUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (authUser: User): Promise<AuthUser | null> => {
    try {
      const [{ data: profile, error: profileError }, { data: roleData, error: roleError }] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', authUser.id).single(),
        supabase.from('user_roles').select('role').eq('user_id', authUser.id).single(),
      ]);

      if (profileError || !profile) {
        console.error('Erro ao carregar perfil:', profileError);
        return null;
      }

      if (roleError) {
        console.error('Erro ao carregar papel do usuário:', roleError);
      }

      return {
        id: authUser.id,
        name: profile.name,
        email: profile.email,
        role: (roleData?.role as UserRole) || 'user',
        sector: profile.sector || '',
        function: profile.function || '',
        phone: profile.phone || '',
        leaderName: profile.leader_name || '',
        firstLogin: profile.first_login ?? true,
        status: profile.status || 'Ativo',
        canCloseTickets: (profile as any).can_close_tickets ?? true,
        canTransferTickets: (profile as any).can_transfer_tickets ?? true,
        canChangeReturnReason: (profile as any).can_change_return_reason ?? false,
        receivesNewTickets: (profile as any).receives_new_tickets ?? true,
        canReopenTickets: (profile as any).can_reopen_tickets ?? false,
      };

    } catch (error) {
      console.error('Erro inesperado ao carregar perfil:', error);
      return null;
    }
  }, []);

  const checkFinanceiroBlock = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_financeiro_pendencias');

      if (error) {
        console.error('Erro ao verificar bloqueio financeiro:', error);
        return { blocked: false, message: '' };
      }

      const pendencias = data ?? [];

      if (!pendencias.length) {
        return { blocked: false, message: '' };
      }

      const meses = pendencias.map((registro) => registro.mes_ano).join(', ');

      return {
        blocked: true,
        message: `O sistema está bloqueado por pendência financeira nos meses: ${meses}.`,
      };
    } catch (error) {
      console.error('Erro inesperado ao validar financeiro:', error);
      return { blocked: false, message: '' };
    }
  }, []);

  useEffect(() => {
    let active = true;

    const applySessionUser = (nextUser: User | null) => {
      if (!active) return;
      setSupabaseUser(nextUser);

      if (!nextUser) {
        setUser(null);
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySessionUser(session?.user ?? null);
    });

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.error('Erro ao restaurar sessão:', error);
        }
        applySessionUser(session?.user ?? null);
      })
      .catch((error) => {
        console.error('Erro ao obter sessão:', error);
        applySessionUser(null);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!supabaseUser) return;

    const syncAuthenticatedUser = async () => {
      setLoading(true);

      try {
        const financeiroStatus = await checkFinanceiroBlock();

        if (cancelled) return;

        if (financeiroStatus.blocked) {
          await supabase.auth.signOut();
          if (!cancelled) {
            setUser(null);
            setSupabaseUser(null);
          }
          return;
        }

        const profileUser = await fetchProfile(supabaseUser);

        if (cancelled) return;
        setUser(profileUser);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void syncAuthenticatedUser();

    return () => {
      cancelled = true;
    };
  }, [supabaseUser, fetchProfile, checkFinanceiroBlock]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      const { translateAuthError } = await import('@/lib/authErrors');
      return { success: false, error: translateAuthError(error.message) };
    }

    const financeiroStatus = await checkFinanceiroBlock();

    if (financeiroStatus.blocked) {
      await supabase.auth.signOut();
      setLoading(false);
      return {
        success: false,
        error: financeiroStatus.message || 'O sistema está bloqueado por pendência financeira.',
      };
    }

    if (data.user) {
      // Check profile status - only allow active users
      const { data: profile } = await supabase
        .from('profiles')
        .select('status, name, sector, function')
        .eq('user_id', data.user.id)
        .single();

      if (profile && profile.status !== 'Ativo') {
        await supabase.auth.signOut();
        setLoading(false);
        return { success: false, error: 'Seu cadastro está inativo. Entre em contato com o administrador.' };
      }

      setTimeout(() => {
        const p: any = profile || {};
        const extras = [p.sector, p.function].filter(Boolean).join(' • ');
        const nomePerfil = p.name || email;
        void logAction('LOGIN', 'auth', data.user!.id, `${nomePerfil} entrou no sistema • E-mail: ${email}${extras ? ' • ' + extras : ''} • Data/Hora do login: ${new Date().toLocaleString('pt-BR')}.`);
      }, 0);

      // Sinaliza que ocorreu um login agora (consumido pelo SystemMessagesModal).
      // Não persiste em refresh: sessionStorage some ao fechar a aba e é consumido na primeira leitura.
      try {
        sessionStorage.setItem('justLoggedInAt', String(Date.now()));
      } catch { /* ignore */ }
    }

    return { success: true };
  }, [checkFinanceiroBlock]);

  const logout = useCallback(async () => {
    setLoading(true);
    setTimeout(() => {
      void logAction('LOGOUT', 'auth', user?.id, `${user?.name || user?.email || 'Usuário'} saiu do sistema (e-mail: ${user?.email || '—'}).`);
    }, 0);
    await supabase.auth.signOut();
    setUser(null);
    setSupabaseUser(null);
    setLoading(false);
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (!supabaseUser) return;
    const profileUser = await fetchProfile(supabaseUser);
    setUser(profileUser);
  }, [supabaseUser, fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, supabaseUser, loading, login, logout, refreshProfile, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
