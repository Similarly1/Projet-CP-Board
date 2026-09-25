import React, { useState } from 'react';
import { X, Calendar, FolderPlus, FileCheck, Check, Loader2 } from 'lucide-react';
import { Meeting, Note } from '../types';
import { api } from '../services/api';
import { useToast } from './Toast';

interface PreparationModalProps {
  meeting: Meeting | null;
  isOpen: boolean;
  onClose: () => void;
  pendingNotes: Note[];
  onSuccess: (meetingDate: string) => void;
}

export const PreparationModal: React.FC<PreparationModalProps> = ({
  meeting,
  isOpen,
  onClose,
  pendingNotes,
  onSuccess,
}) => {
  const { success, error } = useToast();
  const [selectedNoteIds, setSelectedNoteIds] = useState<(string | number)[]>([]);
  const [customNotes, setCustomNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !meeting) return null;

  const toggleNote = (id: string | number) => {
    setSelectedNoteIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleInit = async () => {
    setLoading(true);
    try {
      await api.initMeeting({
        meetingDate: meeting.dateStr,
        title: meeting.title,
        selectedNoteIds,
        customNotes: customNotes.trim() || undefined,
      });

      success(`Dossier et Ordre du Jour créés sur kDrive pour la séance du ${meeting.dateStr} !`);
      onSuccess(meeting.dateStr);
      onClose();
    } catch (err: any) {
      error(err.message || "Erreur lors de l'initialisation de la séance sur kDrive");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Préparer la Séance</h2>
              <p className="text-xs text-slate-400">
                {meeting.title} • {meeting.dateStr}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content scrollable */}
        <div className="overflow-y-auto py-4 space-y-5 flex-1 pr-1">
          
          <div className="p-3.5 rounded-xl bg-slate-850/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
            Cette action va créer sur kDrive :
            <ul className="list-disc list-inside mt-1.5 space-y-0.5 text-slate-400 font-mono text-[11px]">
              <li>Dossier : <span className="text-brand-300">/Comité_Séances/{meeting.dateStr} - Séance du Conseil/</span></li>
              <li>Fichier : <span className="text-brand-300">{meeting.dateStr}_Ordre_du_Jour.md</span></li>
              <li>Sous-dossier : <span className="text-brand-300">Annexes/</span></li>
            </ul>
          </div>

          {/* Sélection des notes en attente */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Notes du groupe ChurchTools à intégrer ({pendingNotes.length})
              </label>
              {pendingNotes.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedNoteIds.length === pendingNotes.length) {
                      setSelectedNoteIds([]);
                    } else {
                      setSelectedNoteIds(pendingNotes.map((n) => n.id));
                    }
                  }}
                  className="text-xs text-brand-400 hover:underline"
                >
                  {selectedNoteIds.length === pendingNotes.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              )}
            </div>

            {pendingNotes.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 text-center text-xs text-slate-400">
                Aucune note en attente dans le groupe comité ChurchTools.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {pendingNotes.map((note) => {
                  const isSelected = selectedNoteIds.includes(note.id);
                  return (
                    <div
                      key={note.id}
                      onClick={() => toggleNote(note.id)}
                      className={`cursor-pointer p-3 rounded-xl border text-xs transition-all ${
                        isSelected
                          ? 'bg-brand-950/40 border-brand-500/40 text-brand-100'
                          : 'bg-slate-800/40 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border transition-colors shrink-0 ${
                            isSelected
                              ? 'bg-brand-500 border-brand-500 text-white'
                              : 'border-slate-600'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-200 line-clamp-2">{note.text}</p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Par {note.authorName} • {new Date(note.createdAt).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes complémentaires */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Notes ou points additionnels pour l'ODJ (optionnel)
            </label>
            <textarea
              rows={3}
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="Ex: - Budget travaux toiture&#10;- Préparation du culte d'action de grâce..."
              className="w-full p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none font-mono"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleInit}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white shadow-lg shadow-brand-600/30 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Création en cours sur kDrive...
              </>
            ) : (
              <>
                <FileCheck className="w-4 h-4" />
                Créer dossier & ODJ kDrive
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
