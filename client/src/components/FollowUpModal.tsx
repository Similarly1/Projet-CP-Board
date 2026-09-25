import React, { useState, useEffect } from 'react';
import { X, Search, UserCheck, AlertCircle, Calendar, User, MessageSquare, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { Person } from '../types';
import { useToast } from './Toast';

interface FollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FollowUpModal: React.FC<FollowUpModalProps> = ({ isOpen, onClose }) => {
  const { success, error } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [personResults, setPersonResults] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const [comment, setComment] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [assigneeResults, setAssigneeResults] = useState<Person[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<Person | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Recherche dynamique des personnes cibles
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setPersonResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.searchPersons(searchQuery);
        setPersonResults(results);
      } catch (e) {
        console.error('Erreur recherche personne:', e);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Recherche des assignés (membres du comité)
  useEffect(() => {
    if (!assigneeQuery.trim() || assigneeQuery.length < 2) {
      setAssigneeResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await api.searchPersons(assigneeQuery);
        setAssigneeResults(results);
      } catch (e) {
        console.error('Erreur recherche assigné:', e);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [assigneeQuery]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson) {
      error('Veuillez sélectionner la personne à suivre.');
      return;
    }
    if (!comment.trim()) {
      error('Veuillez spécifier la consigne / note pastorale.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createFollowUp({
        targetPersonId: selectedPerson.id,
        assigneePersonId: selectedAssignee ? selectedAssignee.id : undefined,
        comment: comment.trim(),
        dueDate: dueDate || undefined,
      });

      success(`Suivi relationnel créé pour ${selectedPerson.displayName} !`);
      onClose();
      // Reset form
      setSelectedPerson(null);
      setSelectedAssignee(null);
      setComment('');
      setDueDate('');
      setSearchQuery('');
      setAssigneeQuery('');
    } catch (err: any) {
      error(err.message || 'Impossible de créer le suivi relationnel.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Créer une Action Relationnelle</h2>
              <p className="text-xs text-slate-400">Suivi pastoral natif ChurchTools (Follow-up)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          
          {/* Personne Cible */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Personne concernée <span className="text-rose-400">*</span>
            </label>

            {selectedPerson ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                    {selectedPerson.firstName?.[0] || 'P'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{selectedPerson.displayName}</p>
                    {selectedPerson.email && <p className="text-xs text-indigo-300">{selectedPerson.email}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPerson(null)}
                  className="text-xs text-indigo-300 hover:text-white underline ml-3"
                >
                  Changer
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Taper un nom ou prénom..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {searching && <Loader2 className="absolute right-3 top-2.5 w-4 h-4 text-indigo-400 animate-spin" />}
                </div>

                {/* Suggestions */}
                {personResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1.5 max-h-48 overflow-y-auto rounded-xl bg-slate-850 border border-slate-700 shadow-xl divide-y divide-slate-800">
                    {personResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPerson(p);
                          setSearchQuery('');
                          setPersonResults([]);
                        }}
                        className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-slate-800/80 transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white">
                          {p.firstName?.[0] || 'U'}
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-medium text-slate-100">{p.displayName}</p>
                          {p.email && <p className="text-xs text-slate-400 truncate">{p.email}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Responsable (Optionnel) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Responsable assigné (optionnel)
            </label>

            {selectedAssignee ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-brand-400" />
                  <span className="text-sm font-medium text-white">{selectedAssignee.displayName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAssignee(null)}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Retirer
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={assigneeQuery}
                  onChange={(e) => setAssigneeQuery(e.target.value)}
                  placeholder="Assigner à un membre du comité..."
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                {assigneeResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1.5 max-h-40 overflow-y-auto rounded-xl bg-slate-850 border border-slate-700 shadow-xl divide-y divide-slate-800">
                    {assigneeResults.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          setSelectedAssignee(a);
                          setAssigneeQuery('');
                          setAssigneeResults([]);
                        }}
                        className="w-full p-2 text-left hover:bg-slate-800 transition-colors text-sm text-slate-200"
                      >
                        {a.displayName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Échéance */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Date d'échéance souhaitée
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Consigne / Commentaire */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Consigne / Sujet du suivi <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ex: Prendre des nouvelles suite à l'hospitalisation, inviter au repas d'accueil..."
              className="w-full p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedPerson}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-lg shadow-indigo-600/30 transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Création...
                </>
              ) : (
                'Envoyer le suivi'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
