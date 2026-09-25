import React, { useState } from 'react';
import { Lock, KeyRound, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from './Toast';

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onSuccess }) => {
  const { success, error } = useToast();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-center">
        
        <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>

        <h2 className="text-lg font-bold text-white mb-1">Accès Sécurisé</h2>
        <p className="text-xs text-slate-400 mb-6">
          Veuillez saisir le mot de passe partagé pour accéder au tableau de bord du comité.
        </p>

        {authError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe de session..."
              className="w-full pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white shadow-lg shadow-brand-600/30 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Vérification...
              </>
            ) : (
              'Déverrouiller'
            )}
          </button>
        </form>

      </div>
    </div>
  );
};
