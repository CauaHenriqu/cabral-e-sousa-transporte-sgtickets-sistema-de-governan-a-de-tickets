import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import logoCabral from '@/assets/logo-cabral-sousa-red.png';
import loginBgTop from '@/assets/login-bg-top.png';
import loginBgBottom from '@/assets/login-bg-bottom.png';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(email, password);
    if (result.success) {
      navigate('/');
    } else {
      const rawError = result.error || '';
      let description = 'E-mail ou senha incorretos.';
      if (rawError.includes('Invalid login credentials')) {
        description = 'E-mail ou senha incorretos.';
      } else if (rawError.includes('Email not confirmed')) {
        description = 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
      } else if (rawError) {
        description = rawError;
      }
      toast({
        title: 'Erro de autenticação',
        description,
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  return (
    <div className="h-screen flex w-full overflow-hidden">
      {/* Barra lateral esquerda com imagens de fundo */}
      <div
        className="hidden md:flex w-1/2 flex-col relative overflow-hidden flex-shrink-0"
        style={{ backgroundColor: '#ff0000' }}
      >
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="flex-1 flex items-center justify-center p-6 min-h-0">
            <img
              src={loginBgTop}
              alt="Cabral & Sousa - A maior distribuidora da Bahia"
              className="max-w-[90%] max-h-full object-contain"
              style={{ imageRendering: 'auto' }}
            />
          </div>
          <div className="flex-1 flex items-center justify-center p-6 min-h-0">
            <img
              src={loginBgBottom}
              alt="Mapa de atuação - Bahia"
              className="max-w-[90%] max-h-full object-contain"
              style={{ imageRendering: 'auto' }}
            />
          </div>
        </div>
      </div>

      {/* Formulário de login */}
      <div className="flex-1 flex items-center justify-center bg-white p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img
              src={logoCabral}
              alt="Cabral & Sousa"
              className="w-full object-contain"
            />
          </div>

          {/* Título */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold" style={{ color: '#c94c4c' }}>
              Transporte - SGTickets
            </h1>
            <p className="text-sm text-muted-foreground mt-1 uppercase tracking-wider">
              Sistema de Governança de Tickets
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* E-mail */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">E-mail</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-11 h-12 rounded-lg border-border/60 bg-background"
                  required
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Senha</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-11 pr-11 h-12 rounded-lg border-border/60 bg-background"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Botão */}
            <Button
              type="submit"
              className="w-full font-semibold h-12 rounded-full text-base text-white"
              style={{ background: 'linear-gradient(90deg, #c94c4c, #d47070)' }}
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>

            {/* Esqueceu senha */}
            <div className="text-center">
              <a
                href="/forgot-password"
                className="text-sm hover:underline"
                style={{ color: '#c94c4c' }}
              >
                Esqueceu sua senha?
              </a>
            </div>

            {/* Identificação da empresa */}
            <div className="text-center pt-2 border-t border-border/60 space-y-1">
              <p className="text-xs text-muted-foreground">
                Sistema interno de chamados da <strong>Cabral &amp; Sousa Ltda.</strong> — acesso restrito a colaboradores.
              </p>
              <a href="/sobre" className="text-xs text-muted-foreground underline">Sobre este sistema</a>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
