import React, { useState } from 'react';
import { Lock, KeyRound, Loader2, AlertCircle, Church, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from './Toast';

interface AuthModalProps {
  isOpen: boolean;
  hasChurchToolsOAuth?: boolean;
  initialError?: string | null;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  hasChurchToolsOAuth = true,
  initialError = null,
  onSuccess 
}) => {
  const { success } = useToast();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(initialError);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setAuthError(null);

    try {
      await api.login(password);
      success('Accès autorisé au Tableau de Bord !');
      onSuccess();
    } catch (err: any) {
      setAuthError(err.message || 'Mot de passe invalide.');
    } finally {
      setLoading(false);
    }
  };

  const handleChurchToolsLogin = () => {
    window.location.href = '/api/auth/churchtools/login';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-center">
        
        <div className="w-14 h-14 rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/10">
          <Church className="w-7 h-7 text-brand-400" />
        </div>

        <h2 className="text-xl font-bold text-white mb-1">Tableau de Bord CP</h2>
        <p className="text-xs text-slate-400 mb-6">
          Accès réservé aux membres du Comité Pastoral.
        </p>

        {authError && (
          <div className="mb-5 p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{authError}</span>
          </div>
        )}

        <div className="space-y-4">
          {hasChurchToolsOAuth && (
            <button
              type="button"
              onClick={handleChurchToolsLogin}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-sky-600 to-brand-600 hover:from-sky-500 hover:to-brand-500 text-white shadow-lg shadow-sky-600/25 transition-all flex items-center justify-center gap-2 group"
            >
              <Church className="w-4 h-4 text-sky-200 group-hover:scale-110 transition-transform" />
              <span>Se connecter avec ChurchTools</span>
              <ArrowRight className="w-4 h-4 text-sky-200 group-hover:translate-x-1 transition-transform" />
            </button>
          )}

          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-slate-800 w-full"></div>
            <span className="bg-slate-900 px-3 text-[11px] uppercase tracking-wider text-slate-500 font-medium">
              ou par mot de passe
            </span>
            <div className="border-t border-slate-800 w-full"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe de session..."
                className="w-full pl-9 pr-3 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Vérification...
                </>
              ) : (
                'Déverrouiller avec le mot de passe'
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
