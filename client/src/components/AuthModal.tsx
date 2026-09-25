import React, { useState } from 'react';
import { AlertCircle, Church, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  hasChurchToolsOAuth?: boolean;
  initialError?: string | null;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  initialError = null 
}) => {
  const [authError] = useState<string | null>(initialError);

  if (!isOpen) return null;

  const handleChurchToolsLogin = () => {
    window.location.href = '/api/auth/churchtools/login';
  };

  return (
    <div className="w-full max-w-sm bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl p-8 text-center backdrop-blur-xl relative z-10">
      
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-brand-500/10">
        <Church className="w-8 h-8 text-sky-400" />
      </div>

      <h2 className="text-xl font-bold text-white mb-1.5">Tableau de Bord CP</h2>
      <p className="text-xs text-slate-400 mb-6 leading-relaxed">
        Accès sécurisé réservé aux membres du Comité Pastoral via votre compte ChurchTools.
      </p>

      {authError && (
        <div className="mb-5 p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 text-left">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{authError}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleChurchToolsLogin}
        className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-sky-600 to-brand-600 hover:from-sky-500 hover:to-brand-500 text-white shadow-lg shadow-sky-600/30 transition-all flex items-center justify-center gap-2.5 group hover:scale-[1.02] active:scale-[0.98]"
      >
        <Church className="w-4 h-4 text-sky-200 group-hover:scale-110 transition-transform" />
        <span>Se connecter avec ChurchTools</span>
        <ArrowRight className="w-4 h-4 text-sky-200 group-hover:translate-x-1 transition-transform" />
      </button>

      <p className="mt-6 text-[11px] text-slate-500">
        Authentification unique (SSO) de l'Assemblée Missionnaire
      </p>

    </div>
  );
};
