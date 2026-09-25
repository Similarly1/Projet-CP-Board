import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Plus,
  Filter,
  Search,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  User,
  LayoutGrid,
  List,
  Loader2,
  Tag
} from 'lucide-react';
import { Task, CommitteeMember } from '../types';
import { api } from '../services/api';
import { useToast } from './Toast';

interface TasksTabProps {
  tasks: Task[];
  onRefreshTasks: () => void;
  isLoading: boolean;
}

export const TasksTab: React.FC<TasksTabProps> = ({
  tasks,
  onRefreshTasks,
  isLoading,
}) => {
  const { success, error } = useToast();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('pending');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Membres officiels du CP
  const [members, setMembers] = useState<CommitteeMember[]>([]);

  useEffect(() => {
    api.getCommitteeMembers().then(setMembers).catch(console.error);
  }, []);

  // Modal d'ajout de tâche
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newRefMeeting, setNewRefMeeting] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Liste des assignés distincts pour les filtres (fusionnée avec les membres du CP)
  const taskAssignees = Array.from(
    new Set(tasks.map((t) => t.assignee).filter(Boolean) as string[])
  );
  const memberMentions = members.map((m) => m.mentionName);
  const allAssignees = Array.from(new Set([...memberMentions, ...taskAssignees])).sort();

  // Filtrage des tâches
  const filteredTasks = tasks.filter((t) => {
    // Filtre statut
    if (filterStatus === 'pending' && t.completed) return false;
    if (filterStatus === 'completed' && !t.completed) return false;

    // Filtre assigné
    if (filterAssignee !== 'all') {
      if (filterAssignee === 'unassigned') {
        if (t.assignee) return false;
      } else if (t.assignee !== filterAssignee) {
        return false;
      }
    }

    // Filtre recherche
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchAssignee = t.assignee?.toLowerCase().includes(q);
      const matchRef = t.refMeeting?.toLowerCase().includes(q);
      if (!matchTitle && !matchAssignee && !matchRef) return false;
    }

    return true;
  });

  // Toggle tâche
  const handleToggle = async (task: Task) => {
    try {
      await api.toggleTask(task.id, !task.completed);
      success(
        !task.completed
          ? `Tâche "${task.title}" marquée comme terminée !`
          : `Tâche "${task.title}" remise en cours.`
      );
      onRefreshTasks();
    } catch (err: any) {
      error(err.message || 'Erreur lors de la mise à jour de la tâche.');
    }
  };

  // Ajout de tâche
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      error("L'intitulé de la tâche est requis.");
      return;
    }

    setIsAdding(true);
    try {
      await api.addTask({
        title: newTitle.trim(),
        assignee: newAssignee.trim() || undefined,
        dueDate: newDueDate || undefined,
        refMeeting: newRefMeeting.trim() || undefined,
      });

      success('Tâche ajoutée en tête de liste dans Taches_Comite.md !');
      setShowAddModal(false);
      setNewTitle('');
      setNewAssignee('');
      setNewDueDate('');
      setNewRefMeeting('');
      onRefreshTasks();
    } catch (err: any) {
      error(err.message || "Erreur lors de l'ajout de la tâche.");
    } finally {
      setIsAdding(false);
    }
  };

  // Compteurs
  const totalCount = tasks.length;
  const pendingCount = tasks.filter((t) => !t.completed).length;
  const overdueCount = tasks.filter((t) => !t.completed && t.isOverdue).length;
  const dueSoonCount = tasks.filter((t) => !t.completed && t.isDueSoon && !t.isOverdue).length;
  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 1. Header & Statistiques */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-400" />
            Registre des Tâches Administratives
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            Source : /Comité_Séances/Taches_Comite.md (Format standard Markdown)
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all self-start sm:self-auto active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Ajouter une tâche
        </button>
      </div>

      {/* 2. Cartes de métriques */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">À faire</p>
            <p className="text-2xl font-black text-white mt-1">{pendingCount}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <CheckSquare className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-rose-300 font-medium">En retard</p>
            <p className="text-2xl font-black text-rose-400 mt-1">{overdueCount}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-amber-300 font-medium">Échéance &lt; 7j</p>
            <p className="text-2xl font-black text-amber-400 mt-1">{dueSoonCount}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-300 font-medium">Terminées</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{completedCount}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Barre de filtres et bascule de vue */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-850">
        
        {/* Recherche */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une tâche, responsable, référence..."
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          
          {/* Filtre statut */}
          <div className="flex items-center rounded-xl bg-slate-800 p-0.5 border border-slate-700/80 text-xs">
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filterStatus === 'pending'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              En cours
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filterStatus === 'completed'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Fait
            </button>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filterStatus === 'all'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Toutes
            </button>
          </div>

          {/* Filtre assigné */}
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">Tous les responsables</option>
            <option value="unassigned">Non assignées</option>
            {allAssignees.map((a) => (
              <option key={a} value={a}>
                @{a}
              </option>
            ))}
          </select>

          {/* Bascule Cartes / Tableau */}
          <div className="flex items-center rounded-xl bg-slate-800 p-0.5 border border-slate-700/80 text-xs">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'cards' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vue Cartes"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vue Tableau"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      {/* 4. Affichage des tâches */}
      {isLoading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-8 h-8 mx-auto text-emerald-400 animate-spin mb-2" />
          <p className="text-xs text-slate-400">Chargement des tâches depuis kDrive...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="py-16 text-center glass-card rounded-2xl border border-slate-800">
          <CheckSquare className="w-12 h-12 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-white">Aucune tâche ne correspond à vos filtres</p>
          <p className="text-xs text-slate-500 mt-1">
            Modifiez les filtres ou ajoutez une nouvelle tâche.
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Vue Cartes */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => {
            let badgeBg = 'bg-slate-800 text-slate-400 border-slate-700';
            let badgeLabel = 'Dans les temps';

            if (task.completed) {
              badgeBg = 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60';
              badgeLabel = 'Terminée';
            } else if (task.isOverdue) {
              badgeBg = 'bg-rose-950/80 text-rose-300 border-rose-500/40 font-semibold animate-pulse';
              badgeLabel = 'En retard';
            } else if (task.isDueSoon) {
              badgeBg = 'bg-amber-950/80 text-amber-300 border-amber-500/40 font-semibold';
              badgeLabel = 'Échéance < 7j';
            }

            return (
              <div
                key={task.id}
                className={`glass-card p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  task.completed
                    ? 'border-slate-800/50 opacity-60'
                    : task.isOverdue
                    ? 'border-rose-500/30'
                    : 'border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggle(task)}
                      className="mt-1 w-4 h-4 rounded border-slate-600 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900 bg-slate-800 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          task.completed
                            ? 'line-through text-slate-400'
                            : 'text-slate-100'
                        }`}
                      >
                        {task.title}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 truncate">
                    {task.assignee ? (
                      <span className="flex items-center gap-1 text-slate-300 font-medium">
                        <User className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                        <span className="truncate">@{task.assignee}</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">Non assignée</span>
                    )}

                    {task.refMeeting && (
                      <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                        • {task.refMeeting}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.dueDate && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        {task.dueDate}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-[10px] border ${badgeBg}`}>
                      {badgeLabel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vue Tableau */
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-10">Statut</th>
                  <th className="py-3 px-4">Tâche</th>
                  <th className="py-3 px-4">Responsable</th>
                  <th className="py-3 px-4">Échéance</th>
                  <th className="py-3 px-4">Réf Séance</th>
                  <th className="py-3 px-4 text-right">Urgence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      task.completed ? 'opacity-60 line-through' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => handleToggle(task)}
                        className="w-4 h-4 rounded border-slate-600 text-emerald-600 focus:ring-emerald-500 bg-slate-800 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-200">
                      {task.title}
                    </td>
                    <td className="py-3 px-4">
                      {task.assignee ? (
                        <span className="text-brand-300 font-medium">@{task.assignee}</span>
                      ) : (
                        <span className="text-slate-500 italic">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {task.dueDate || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {task.refMeeting || '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${
                          task.completed
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                            : task.isOverdue
                            ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                            : task.isDueSoon
                            ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {task.completed
                          ? 'Fait'
                          : task.isOverdue
                          ? 'En retard'
                          : task.isDueSoon
                          ? '< 7 jours'
                          : 'Dans les temps'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Ajout Tâche */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 overflow-hidden">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                Nouvelle Tâche Administrative
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Intitulé de la tâche <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Remplacer le projecteur de la salle annexe"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Responsable assigné (ex: @Adrien, @Marc...)
                </label>
                <input
                  type="text"
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  placeholder="Adrien (le @ sera ajouté automatiquement)"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />

                {/* Boutons rapides membres du CP */}
                {members.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-400 font-semibold mr-1">Membres CP :</span>
                    {members.map((m) => {
                      const isSelected = newAssignee.toLowerCase() === m.mentionName.toLowerCase();
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setNewAssignee(m.mentionName)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white font-bold'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          @{m.mentionName}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Date d'échéance
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Référence séance
                  </label>
                  <input
                    type="text"
                    value={newRefMeeting}
                    onChange={(e) => setNewRefMeeting(e.target.value)}
                    placeholder="2026-10-15"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-300 hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isAdding || !newTitle.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-md shadow-emerald-600/20"
                >
                  {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Ajouter dans kDrive
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
