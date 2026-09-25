import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { UnifiedMeetingsTab } from './components/UnifiedMeetingsTab';
import { TasksTab } from './components/TasksTab';
import { DashboardTab } from './components/DashboardTab';
import { FollowUpModal } from './components/FollowUpModal';
import { PreparationModal } from './components/PreparationModal';
import { AuthModal } from './components/AuthModal';
import { ToastProvider, useToast } from './components/Toast';
import { Meeting, Task, Note, SystemStatus } from './types';
import { api } from './services/api';
import { AlertCircle, RefreshCw } from 'lucide-react';

const AppContent: React.FC = () => {
  const { error } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'meetings' | 'tasks'>('overview');
  const [selectedMeetingDate, setSelectedMeetingDate] = useState<string | undefined>(undefined);

  // Données globales
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  // États de chargement
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTasksLoading, setIsTasksLoading] = useState(false);

  // Authentification
  const [authNeeded, setAuthNeeded] = useState(false);
  const [hasChurchToolsOAuth, setHasChurchToolsOAuth] = useState(true);
  const [authErrorMsg, setAuthErrorMsg] = useState<string | null>(null);

  // Modales
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [prepModalMeeting, setPrepModalMeeting] = useState<Meeting | null>(null);

  // Initialisation et vérification Auth
  const initApp = useCallback(async () => {
    try {
      // 1. Détection des retours OAuth depuis ChurchTools dans l'URL
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('auth_token');
      const urlUser = urlParams.get('auth_user');
      const urlError = urlParams.get('auth_error');

      if (urlToken) {
        api.setAuthToken(urlToken);
        if (urlUser) {
          localStorage.setItem('cp_board_user_name', urlUser);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      if (urlError) {
        setAuthErrorMsg(urlError);
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // 2. Vérification de la session auprès de l'API
      const auth = await api.checkAuth();
      setHasChurchToolsOAuth(Boolean(auth.hasChurchToolsOAuth));

      if (auth.authRequired && !auth.authenticated) {
        setAuthNeeded(true);
        return;
      }
      setAuthNeeded(false);

      // Chargement du statut et des données
      refreshAll();
    } catch (e: any) {
      console.error("Erreur d'initialisation:", e);
    }
  }, []);

  useEffect(() => {
    initApp();

    const handleUnauthorized = () => {
      setAuthNeeded(true);
    };
    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, [initApp]);

  // Actualisation complète
  const refreshAll = async () => {
    setIsRefreshing(true);
    try {
      const [statusRes, meetingsRes, notesRes] = await Promise.allSettled([
        api.getStatus(),
        api.getUpcomingMeetings(true),
        api.getPendingNotes(),
      ]);

      if (statusRes.status === 'fulfilled') {
        setStatus(statusRes.value);
      }
      if (meetingsRes.status === 'fulfilled') {
        setMeetings(meetingsRes.value);
      }
      if (notesRes.status === 'fulfilled') {
        setNotes(notesRes.value);
      }

      // Charger les tâches kDrive séparément
      refreshTasks();
    } catch (err: any) {
      console.error('Erreur rafraîchissement global:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Actualisation spécifique des tâches
  const refreshTasks = async () => {
    setIsTasksLoading(true);
    try {
      const taskList = await api.getTasks();
      setTasks(taskList);
    } catch (e: any) {
      console.error('Erreur chargement tâches kDrive:', e);
    } finally {
      setIsTasksLoading(false);
    }
  };

  const handleOpenPrepModal = (meeting: Meeting) => {
    setPrepModalMeeting(meeting);
  };

  const handlePrepSuccess = (dateStr: string) => {
    refreshAll();
    setSelectedMeetingDate(dateStr);
    setActiveTab('meetings');
  };

  const handleNavigateTab = (tab: 'meetings' | 'tasks' | 'overview', meetingDate?: string) => {
    if (meetingDate) {
      setSelectedMeetingDate(meetingDate);
    }
    setActiveTab(tab);
  };

  if (authNeeded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950 text-slate-100 relative overflow-hidden">
        {/* Halos d'ambiance discrets */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-20 right-10 w-80 h-80 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none" />

        <AuthModal
          isOpen={true}
          hasChurchToolsOAuth={hasChurchToolsOAuth}
          initialError={authErrorMsg}
          onSuccess={() => {
            setAuthErrorMsg(null);
            initApp();
          }}
        />

        <footer className="mt-8 text-center text-xs text-slate-600 relative z-10">
          <p>Tableau de Bord Comité • Assemblée Missionnaire Delémont</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      
      {/* Barre de navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        status={status}
        onRefresh={refreshAll}
        isRefreshing={isRefreshing}
        onOpenFollowUp={() => setIsFollowUpOpen(true)}
      />

      {/* Contenu principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Alerte si integrations non configurées */}
        {status && (!status.churchTools.configured || !status.kDrive.configured) && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-100">Configuration requise dans le fichier .env</p>
              <p className="text-amber-300/90 leading-relaxed">
                {!status.churchTools.configured && '• ChurchTools : Définissez CHURCHTOOLS_BASE_URL, CHURCHTOOLS_API_TOKEN et CHURCHTOOLS_COMMITTEE_GROUP_ID.'}
                <br />
                {!status.kDrive.configured && '• Infomaniak kDrive : Définissez KDRIVE_API_TOKEN, KDRIVE_DRIVE_ID et KDRIVE_ROOT_FOLDER_ID.'}
              </p>
            </div>
          </div>
        )}

        {/* Tab 1 : Séances (OJ & PV) - Vue Unifiée */}
        {activeTab === 'meetings' && (
          <UnifiedMeetingsTab />
        )}

        {/* Tab 2 : Tâches Administratives */}
        {activeTab === 'tasks' && (
          <TasksTab
            tasks={tasks}
            onRefreshTasks={refreshTasks}
            isLoading={isTasksLoading}
          />
        )}

        {/* Tab 3 : Vue d'ensemble */}
        {activeTab === 'overview' && (
          <DashboardTab
            meetings={meetings}
            tasks={tasks}
            notes={notes}
            onOpenPrepModal={handleOpenPrepModal}
            onNavigateTab={(tab) => {
              if (tab === 'tasks') setActiveTab('tasks');
              else setActiveTab('meetings');
            }}
            onOpenFollowUp={() => setIsFollowUpOpen(true)}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-slate-900 text-center text-xs text-slate-500">
        <p>
          Tableau de Bord Comité d'Église • Intégration ChurchTools API & Infomaniak kDrive v3 • Zero Vendor Lock-in (Markdown .md)
        </p>
      </footer>


      {/* Modale Follow-up ChurchTools */}
      <FollowUpModal isOpen={isFollowUpOpen} onClose={() => setIsFollowUpOpen(false)} />

      {/* Modale Préparation de séance */}
      <PreparationModal
        meeting={prepModalMeeting}
        isOpen={Boolean(prepModalMeeting)}
        onClose={() => setPrepModalMeeting(null)}
        pendingNotes={notes}
        onSuccess={handlePrepSuccess}
      />

    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;
