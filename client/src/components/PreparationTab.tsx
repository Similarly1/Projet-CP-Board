import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  FileText,
  FolderPlus,
  Check,
  Save,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { Meeting, Note } from '../types';
import { api } from '../services/api';
import { useToast } from './Toast';

interface PreparationTabProps {
  meetings: Meeting[];
  notes: Note[];
  selectedMeetingDate?: string;
  onRefreshMeetings: () => void;
  onRefreshNotes: () => void;
  onNavigateToSession: (meetingDate: string) => void;
}

export const PreparationTab: React.FC<PreparationTabProps> = ({
  meetings,
  notes,
  selectedMeetingDate,
  onRefreshMeetings,
  onRefreshNotes,
  onNavigateToSession,
}) => {
  const { success, error } = useToast();
  
  // Séance sélectionnée
  const [currentDate, setCurrentDate] = useState<string>(
    selectedMeetingDate || meetings[0]?.dateStr || new Date().toISOString().split('T')[0]
  );

  const activeMeeting = meetings.find((m) => m.dateStr === currentDate) || null;

  // Notes sélectionnées pour l'ODJ
  const [selectedNoteIds, setSelectedNoteIds] = useState<(string | number)[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // État du document ODJ
  const [odjContent, setOdjContent] = useState<string>('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    if (selectedMeetingDate) {
      setCurrentDate(selectedMeetingDate);
    }
  }, [selectedMeetingDate]);

  // Charger le contenu de l'ODJ si le fichier existe
  useEffect(() => {
    const fetchOdj = async () => {
      if (activeMeeting?.kDrive?.odjFileId) {
        setLoadingContent(true);
        try {
          const content = await api.getFileContent(activeMeeting.kDrive.odjFileId);
          setOdjContent(content);
          setHasUnsavedChanges(false);
        } catch (e: any) {
          console.error('Erreur lecture ODJ:', e);
        } finally {
          setLoadingContent(false);
        }
      } else {
        setOdjContent('');
        setHasUnsavedChanges(false);
      }
    };

    fetchOdj();
  }, [activeMeeting?.kDrive?.odjFileId]);

  const toggleNoteSelection = (id: string | number) => {
    setSelectedNoteIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Ajout rapide d'une note ChurchTools
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    setIsAddingNote(true);
    try {
      await api.createNote(newNoteText.trim());
      success('Note ajoutée au groupe comité ChurchTools !');
      setNewNoteText('');
      onRefreshNotes();
    } catch (err: any) {
      error(err.message || "Erreur lors de l'ajout de la note");
    } finally {
      setIsAddingNote(false);
    }
  };

  // Initialisation du dossier & ODJ sur kDrive
  const handleInitMeeting = async () => {
    setIsInitializing(true);
    try {
      const res = await api.initMeeting({
        meetingDate: currentDate,
        title: activeMeeting?.title || 'Séance du Conseil',
        selectedNoteIds,
      });

      success(`Dossier et Ordre du Jour créés sur kDrive !`);
      onRefreshMeetings();
      // Charger directement le contenu créé
      const content = await api.getFileContent(res.odjFileId);
      setOdjContent(content);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      error(err.message || 'Erreur lors de la création sur kDrive.');
    } finally {
      setIsInitializing(false);
    }
  };

  // Sauvegarde manuelle du fichier Markdown
  const handleSaveOdj = async () => {
    if (!activeMeeting?.kDrive?.odjFileId) return;

    setSavingContent(true);
    try {
      await api.saveFileContent({
        fileId: activeMeeting.kDrive.odjFileId,
        content: odjContent,
        parentFolderId: activeMeeting.kDrive.folderId,
        fileName: `${currentDate}_Ordre_du_Jour.md`,
      });

      success('Ordre du jour enregistré sur kDrive !');
      setHasUnsavedChanges(false);
    } catch (err: any) {
      error(err.message || 'Erreur lors de la sauvegarde sur kDrive.');
    } finally {
      setSavingContent(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 1. Sélecteur de Séance & En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-400" />
            Préparation de Séance & Ordre du Jour
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Collecte des sujets ChurchTools et génération de l'ODJ Markdown sur kDrive
          </p>
        </div>

        {/* Sélecteur de date / réunion */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 font-medium whitespace-nowrap">
            Séance ciblée :
          </label>
          <select
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {meetings.map((m) => (
              <option key={m.id} value={m.dateStr}>
                {m.dateStr} - {m.title}
              </option>
            ))}
            {!meetings.some((m) => m.dateStr === currentDate) && (
              <option value={currentDate}>{currentDate} (Personnalisée)</option>
            )}
          </select>
        </div>
      </div>

      {/* 2. Deux colonnes : Notes ChurchTools à gauche / Éditeur ODJ kDrive à droite */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Colonne gauche (5 cols) : Notes de groupe ChurchTools */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Bloc d'ajout de note rapide */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Plus className="w-4 h-4 text-sky-400" />
              Ajouter une note de préparation
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Enregistre le sujet directement dans le groupe comité ChurchTools.
            </p>

            <form onSubmit={handleCreateNote} className="space-y-3">
              <textarea
                rows={2}
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Ex: Point à aborder : devis sonorisation de la grande salle..."
                className="w-full p-3 bg-slate-850/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isAddingNote || !newNoteText.trim()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition-all shadow-sm"
                >
                  {isAddingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Ajouter au groupe
                </button>
              </div>
            </form>
          </div>

          {/* Liste des notes en attente avec case "Inclure dans le futur ODJ" */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-brand-400" />
                  Notes du Groupe en attente
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cochez les points à intégrer dans l'Ordre du Jour
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {notes.length}
              </span>
            </div>

            {notes.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 italic bg-slate-850/40 rounded-xl border border-slate-800/60">
                Aucune note en attente dans le groupe comité.
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {notes.map((note) => {
                  const isSelected = selectedNoteIds.includes(note.id);
                  return (
                    <div
                      key={note.id}
                      onClick={() => toggleNoteSelection(note.id)}
                      className={`cursor-pointer p-3 rounded-xl border text-xs transition-all ${
                        isSelected
                          ? 'bg-brand-950/40 border-brand-500/50 shadow-sm'
                          : 'bg-slate-850/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border transition-colors shrink-0 ${
                            isSelected
                              ? 'bg-brand-500 border-brand-500 text-white'
                              : 'border-slate-600 bg-slate-900'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-200">{note.text}</p>
                          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                            <span>@{note.authorName}</span>
                            <span>•</span>
                            <span>{new Date(note.createdAt).toLocaleDateString('fr-FR')}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bouton Créer Dossier kDrive + ODJ si non créé */}
            {!activeMeeting?.kDrive?.hasFolder && (
              <div className="mt-4 pt-3 border-t border-slate-800">
                <button
                  onClick={handleInitMeeting}
                  disabled={isInitializing}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white shadow-lg shadow-brand-600/20 transition-all"
                >
                  {isInitializing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Génération kDrive en cours...
                    </>
                  ) : (
                    <>
                      <FolderPlus className="w-4 h-4" />
                      Créer le dossier kDrive & Générer l'ODJ ({selectedNoteIds.length} note(s) incluse(s))
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Colonne droite (7 cols) : Éditeur / Aperçu de l'Ordre du Jour */}
        <div className="lg:col-span-7">
          <div className="glass-card rounded-2xl border border-slate-800 p-5 flex flex-col h-full min-h-[580px]">
            
            {/* Header de l'éditeur */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-400" />
                <h3 className="font-bold text-sm text-white">
                  {currentDate}_Ordre_du_Jour.md
                </h3>
                {hasUnsavedChanges && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                    Modifié
                  </span>
                )}
              </div>

              {activeMeeting?.kDrive?.hasFolder && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveOdj}
                    disabled={savingContent || !hasUnsavedChanges}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-all shadow-sm"
                  >
                    {savingContent ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Enregistrer
                  </button>

                  <button
                    onClick={() => onNavigateToSession(currentDate)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm"
                  >
                    Passer au PV &rarr;
                  </button>
                </div>
              )}
            </div>

            {/* Contenu */}
            {!activeMeeting?.kDrive?.hasFolder ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-850/40 rounded-xl border border-slate-800/80">
                <FolderPlus className="w-12 h-12 text-slate-600 mb-3" />
                <h4 className="text-base font-semibold text-white mb-1">
                  Séance non encore initialisée sur kDrive
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mb-4">
                  Sélectionnez les notes ChurchTools à gauche, puis cliquez sur le bouton pour créer automatiquement l'arborescence et le fichier Markdown sur Infomaniak kDrive.
                </p>
                <button
                  onClick={handleInitMeeting}
                  disabled={isInitializing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-600/20"
                >
                  {isInitializing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FolderPlus className="w-4 h-4" />
                  )}
                  Initialiser maintenant
                </button>
              </div>
            ) : loadingContent ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <textarea
                  value={odjContent}
                  onChange={(e) => {
                    setOdjContent(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Contenu Markdown de l'ordre du jour..."
                  className="flex-1 w-full p-4 bg-slate-900 border border-slate-850 rounded-xl font-mono text-xs sm:text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none leading-relaxed"
                />
                <p className="text-[10px] text-slate-500 mt-2 text-right">
                  Sauvegarde manuelle pour préserver les quotas d'API kDrive.
                </p>
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
};
