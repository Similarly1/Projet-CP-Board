import React, { useState } from 'react';
import {
  Calendar,
  FileText,
  CheckSquare,
  UserPlus,
  RefreshCw,
  Server,
  Cloud,
  Database,
  ExternalLink,
  ChevronDown,
  LayoutDashboard
} from 'lucide-react';
import { SystemStatus } from '../types';

interface NavbarProps {
  activeTab: 'meetings' | 'tasks' | 'overview';
  setActiveTab: (tab: 'meetings' | 'tasks' | 'overview') => void;
  status: SystemStatus | null;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenFollowUp: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  status,
  onRefresh,
  isRefreshing,
  onOpenFollowUp,
}) => {
  const [showStatusPopover, setShowStatusPopover] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Titre */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 text-white font-bold text-lg">
              ⛪
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg tracking-tight text-white flex items-center gap-2">
                Tableau de Bord Comité
                <span className="hidden sm:inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  CT + kDrive
                </span>
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                Gestion des séances, documents & tâches
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'overview'
                  ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-sky-400" />
              <span>Vue d'ensemble</span>
            </button>

            <button
              onClick={() => setActiveTab('meetings')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'meetings'
                  ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold">Séances (OJ & PV)</span>
            </button>

            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'tasks'
                  ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              <span>Tâches Comité</span>
            </button>
          </nav>

          {/* Actions & Status */}
          <div className="flex items-center gap-2">
            
            {/* Bouton Action Follow-up ChurchTools */}
            <button
              onClick={onOpenFollowUp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all active:scale-95"
              title="Créer un suivi relationnel (ChurchTools Follow-up)"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Follow-up</span>
            </button>

            {/* Bouton Rafraîchir */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors disabled:opacity-50"
              title="Actualiser les données"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-brand-400' : ''}`} />
            </button>

            {/* Indicateur de connectivité / Status Popover */}
            <div className="relative">
              <button
                onClick={() => setShowStatusPopover(!showStatusPopover)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-xs text-slate-300 border border-slate-700/60 transition-colors"
                title="État des connexions"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    status?.churchTools.connected && status?.kDrive.connected
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                      : status?.churchTools.configured || status?.kDrive.configured
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                />
                <span className="hidden lg:inline">Statut</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showStatusPopover && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      État des intégrations
                    </h3>
                    <span className="text-[10px] text-slate-500">API Proxy</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    {/* ChurchTools */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-sky-400 shrink-0" />
                        <div>
                          <p className="font-medium text-slate-200">ChurchTools API</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[170px]">
                            {status?.churchTools.baseUrl || 'Non configuré'}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          status?.churchTools.connected
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                            : status?.churchTools.configured
                            ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {status?.churchTools.connected
                          ? 'En ligne'
                          : status?.churchTools.configured
                          ? 'Erreur'
                          : 'Inactif'}
                      </span>
                    </div>

                    {/* kDrive */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-indigo-400 shrink-0" />
                        <div>
                          <p className="font-medium text-slate-200">Infomaniak kDrive</p>
                          <p className="text-[10px] text-slate-400">
                            {status?.kDrive.configured
                              ? `Drive #${status.kDrive.driveId}`
                              : 'Non configuré'}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          status?.kDrive.connected
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                            : status?.kDrive.configured
                            ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {status?.kDrive.connected
                          ? 'En ligne'
                          : status?.kDrive.configured
                          ? 'Erreur'
                          : 'Inactif'}
                      </span>
                    </div>

                    {/* SQLite */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <p className="font-medium text-slate-200">Base SQLite locale</p>
                          <p className="text-[10px] text-slate-400">data/app.db (Cache)</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                        Active
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Zéro exposition de token</span>
                    <span className="text-slate-500">Node BFF Proxy</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </header>
  );
};
