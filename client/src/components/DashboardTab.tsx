import React from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  FolderCheck,
  FolderPlus,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Plus,
  CheckSquare,
  MessageSquare
} from 'lucide-react';
import { Meeting, Task, Note } from '../types';

interface DashboardTabProps {
  meetings: Meeting[];
  tasks: Task[];
  notes: Note[];
  onOpenPrepModal: (meeting: Meeting) => void;
  onNavigateTab: (tab: 'overview' | 'prep' | 'session' | 'tasks', meetingDate?: string) => void;
  onOpenFollowUp: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  meetings,
  tasks,
  notes,
  onOpenPrepModal,
  onNavigateTab,
  onOpenFollowUp,
}) => {
  const nextMeeting = meetings[0] || null;
  const subsequentMeetings = meetings.slice(1, 4);

  // Calcul du compte à rebours
  const getCountdownLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(dateStr);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Demain';
    if (diffDays < 0) return `Il y a ${Math.abs(diffDays)} jours`;
    return `Dans ${diffDays} jours`;
  };

  // Tâches urgentes
  const overdueTasks = tasks.filter((t) => !t.completed && t.isOverdue);
  const dueSoonTasks = tasks.filter((t) => !t.completed && t.isDueSoon && !t.isOverdue);
  const pendingTasksCount = tasks.filter((t) => !t.completed).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* 1. Prochaine séance du Comité (En vedette) */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">Prochaine Séance du Comité</h2>
          </div>
          {nextMeeting && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-300 border border-brand-500/20">
              {getCountdownLabel(nextMeeting.dateStr)}
            </span>
          )}
        </div>

        {nextMeeting ? (
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden border border-brand-500/20 shadow-xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              
              {/* Informations séance */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                    {nextMeeting.title}
                  </h3>
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {nextMeeting.dateStr}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-brand-400" />
                    <span>
                      {new Date(nextMeeting.startDate).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {nextMeeting.endDate &&
                        ` - ${new Date(nextMeeting.endDate).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`}
                    </span>
                  </div>

                  {nextMeeting.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-brand-400" />
                      <span>{nextMeeting.location}</span>
                    </div>
                  )}

                  {nextMeeting.calendarName && (
                    <span className="text-slate-500">• {nextMeeting.calendarName}</span>
                  )}
                </div>

                {/* Statut kDrive de la séance */}
                <div className="pt-2 flex items-center gap-3 text-xs">
                  <span className="text-slate-400 font-medium">Statut kDrive :</span>
                  {nextMeeting.kDrive.hasFolder ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 font-medium">
                        <FolderCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Dossier prêt
                      </span>
                      {nextMeeting.kDrive.odjFileId && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-950/60 text-sky-300 border border-sky-800/60 font-medium">
                          <FileText className="w-3.5 h-3.5 text-sky-400" />
                          ODJ généré
                        </span>
                      )}
                      {nextMeeting.kDrive.pvFileId && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 font-medium">
                          <FileText className="w-3.5 h-3.5 text-indigo-400" />
                          PV en cours
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/60 font-medium">
                      <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                      Dossier non créé
                    </span>
                  )}
                </div>
              </div>

              {/* Actions rapides sur la séance */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {!nextMeeting.kDrive.hasFolder ? (
                  <button
                    onClick={() => onOpenPrepModal(nextMeeting)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/30 transition-all active:scale-95"
                  >
                    <FolderPlus className="w-4 h-4" />
                    Préparer la séance
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => onNavigateTab('prep', nextMeeting.dateStr)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                    >
                      <FileText className="w-4 h-4 text-brand-400" />
                      Voir l'ODJ
                    </button>

                    <button
                      onClick={() => onNavigateTab('session', nextMeeting.dateStr)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
                    >
                      <FileText className="w-4 h-4" />
                      {nextMeeting.kDrive.pvFileId ? 'Ouvrir le PV' : 'Démarrer le PV'}
                    </button>
                  </>
                )}
              </div>

            </div>
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-8 text-center text-slate-400">
            <Calendar className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-medium">Aucune prochaine séance trouvée sur ChurchTools.</p>
            <p className="text-xs text-slate-500 mt-1">
              Vérifiez la synchronisation ou les filtres d'événements.
            </p>
          </div>
        )}
      </section>

      {/* 2. Grille synthétique : Tâches urgentes & Notes en attente & Séances suivantes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Tâches Administratives Urgentes */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Tâches Administratives</h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {pendingTasksCount} en cours
              </span>
            </div>

            {overdueTasks.length > 0 && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{overdueTasks.length} tâche(s) en retard</span>
              </div>
            )}

            {dueSoonTasks.length > 0 && (
              <div className="mb-3 p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-300">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{dueSoonTasks.length} tâche(s) à échéance dans &lt; 7j</span>
              </div>
            )}

            <div className="space-y-2 mt-3">
              {tasks.filter((t) => !t.completed).slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="p-2.5 rounded-xl bg-slate-850/60 border border-slate-800 text-xs text-slate-300 flex items-start gap-2"
                >
                  <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${task.isOverdue ? 'bg-rose-500' : task.isDueSoon ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                  <div className="flex-1 truncate">
                    <p className="truncate font-medium text-slate-200">{task.title}</p>
                    <p className="text-[10px] text-slate-400">
                      {task.assignee ? `@${task.assignee}` : 'Non assignée'} • {task.dueDate || 'Sans date'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('tasks')}
            className="mt-4 flex items-center justify-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-medium py-1"
          >
            <span>Voir toutes les tâches</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Notes du Groupe Comité (Préparation ODJ) */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sky-400" />
                <h3 className="font-bold text-sm text-white">Notes de Préparation</h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {notes.length} en attente
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Sujets enregistrés par les membres pour les prochains ordres du jour.
            </p>

            <div className="space-y-2">
              {notes.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">
                  Aucune note en attente.
                </p>
              ) : (
                notes.slice(0, 3).map((note) => (
                  <div
                    key={note.id}
                    className="p-2.5 rounded-xl bg-slate-850/60 border border-slate-800 text-xs text-slate-300"
                  >
                    <p className="line-clamp-2 text-slate-200 font-medium">{note.text}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {note.authorName} • {new Date(note.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('prep')}
            className="mt-4 flex items-center justify-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-medium py-1"
          >
            <span>Ajouter une note ou préparer l'ODJ</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Séances suivantes programmées */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">Calendrier des Séances</h3>
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Prochaines réunions issues de ChurchTools.
            </p>

            <div className="space-y-2.5">
              {subsequentMeetings.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">
                  Pas d'autres séances programmées.
                </p>
              ) : (
                subsequentMeetings.map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-xl bg-slate-850/60 border border-slate-800 text-xs text-slate-300 flex items-center justify-between"
                  >
                    <div className="truncate">
                      <p className="font-semibold text-slate-200 truncate">{m.title}</p>
                      <p className="text-[10px] text-slate-400">{m.dateStr}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium shrink-0 ml-2">
                      {getCountdownLabel(m.dateStr)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={onOpenFollowUp}
            className="mt-4 flex items-center justify-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium py-1"
          >
            <span>Créer un suivi relationnel (Follow-up)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

    </div>
  );
};
