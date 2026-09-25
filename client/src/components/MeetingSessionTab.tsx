import React, { useState, useEffect } from 'react';
import {
  FileText,
  Play,
  Save,
  UploadCloud,
  File,
  ExternalLink,
  Loader2,
  Calendar,
  CheckCircle2,
  FolderOpen,
  Paperclip,
  FileCode,
  FileType
} from 'lucide-react';
import { Meeting, KDriveFile, KDriveSession } from '../types';
import { api } from '../services/api';
import { useToast } from './Toast';
import { RichMeetingEditor } from './RichMeetingEditor';

interface MeetingSessionTabProps {
  meetings: Meeting[];
  selectedMeetingDate?: string;
  onRefreshMeetings: () => void;
}

export const MeetingSessionTab: React.FC<MeetingSessionTabProps> = ({
  meetings,
  selectedMeetingDate,
  onRefreshMeetings,
}) => {
  const { success, error } = useToast();
  
  // Sessions kDrive complètes (y compris historique 2026 : CP 09.24, CP 09.03...)
  const [sessions, setSessions] = useState<KDriveSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Identifiant ou date de la séance sélectionnée
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  // PV state
  const [pvContent, setPvContent] = useState<string>('');
  const [loadingPv, setLoadingPv] = useState(false);
  const [savingPv, setSavingPv] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isStartingPv, setIsStartingPv] = useState(false);

  // Annexes & pièces jointes state
  const [files, setFiles] = useState<KDriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Charger toutes les séances depuis kDrive
  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await api.getSessions();
      setSessions(data);
      if (data.length > 0 && !selectedSessionId) {
        setSelectedSessionId(String(data[0].id));
      }
    } catch (e: any) {
      console.error('Erreur chargement séances kDrive:', e);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  // Déterminer la séance active (soit par son ID de dossier kDrive, soit par sa date)
  const activeSession = sessions.find((s) => String(s.id) === selectedSessionId) || sessions[0] || null;
  const activeMeeting = meetings.find((m) => activeSession && m.kDrive?.folderId && String(m.kDrive.folderId) === String(activeSession.id)) || null;

  // Charger les fichiers du dossier de la séance active
  const loadFolderFiles = async () => {
    if (!activeSession) return;
    setLoadingFiles(true);
    try {
      const fileList = await api.getFolderFiles(activeSession.id);
      setFiles(fileList);
    } catch (e) {
      console.error('Erreur chargement annexes:', e);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (activeSession) {
      loadFolderFiles();
    }
  }, [activeSession?.id]);

  // Fichiers PV et ODJ de la séance active
  const pvFile = activeSession?.pv || files.find((f) => f.name.toLowerCase().includes('pv')) || null;
  const odjFile = activeSession?.odj || files.find((f) => {
    const n = f.name.toLowerCase();
    return n.includes('ordre_du_jour') || n.includes('odj') || n.startsWith('oj');
  }) || null;

  const isPvDocx = pvFile && /\.(docx?)$/i.test(pvFile.name);
  const isPvMd = pvFile && /\.md$/i.test(pvFile.name);

  // Charger le contenu Markdown s'il y a un PV Markdown
  useEffect(() => {
    const fetchPvMd = async () => {
      if (pvFile && isPvMd) {
        setLoadingPv(true);
        try {
          const content = await api.getFileContent(pvFile.id);
          setPvContent(content);
          setHasUnsavedChanges(false);
        } catch (e: any) {
          console.error('Erreur lecture PV Markdown:', e);
        } finally {
          setLoadingPv(false);
        }
      } else {
        setPvContent('');
        setHasUnsavedChanges(false);
      }
    };

    fetchPvMd();
  }, [pvFile?.id, isPvMd]);

  // Sauvegarder le PV Markdown
  const handleSavePv = async () => {
    if (!pvFile || !activeSession) return;

    setSavingPv(true);
    try {
      await api.saveFileContent({
        fileId: pvFile.id,
        content: pvContent,
        parentFolderId: activeSession.id,
        fileName: pvFile.name,
      });

      success('Procès-verbal enregistré sur kDrive !');
      setHasUnsavedChanges(false);
    } catch (err: any) {
      error(err.message || 'Erreur lors de la sauvegarde du PV.');
    } finally {
      setSavingPv(false);
    }
  };

  // Téléversement d'un fichier annexe
  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (!activeSession) {
      error('Dossier kDrive non sélectionné.');
      return;
    }

    const file = fileList[0];
    setIsUploading(true);

    try {
      await api.uploadFile(activeSession.id, file);
      success(`Fichier "${file.name}" téléversé avec succès sur kDrive !`);
      loadFolderFiles();
      fetchSessions();
    } catch (err: any) {
      error(err.message || 'Erreur lors du téléversement du fichier.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 1. Sélecteur de Séance & En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            Séance en Direct & Procès-Verbal
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Accès aux dossiers de séances, édition Word OnlyOffice & Markdown
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 font-medium whitespace-nowrap">
            Séance kDrive :
          </label>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-xs"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.fileCount} doc{s.fileCount > 1 ? 's' : ''})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Grille principale : PV (8 cols) & Pièces jointes kDrive (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Colonne gauche (8 cols) : Rédacteur de PV / Document Word OnlyOffice */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* Panneau de documents de la séance */}
          <div className="glass-card rounded-2xl border border-slate-800 p-6">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold">
                  📁
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {activeSession ? activeSession.name : 'Séance'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Dossier kDrive #{activeSession?.id}
                  </p>
                </div>
              </div>

              {activeSession?.kdriveUrl && (
                <a
                  href={activeSession.kdriveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-300 bg-indigo-950/60 border border-indigo-800/60 hover:bg-indigo-900/60 transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Ouvrir le dossier dans kDrive
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Carte dédiée au Document Word (OnlyOffice) si existant */}
            {isPvDocx && pvFile ? (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900 border border-blue-500/30 shadow-lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="p-3 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shrink-0">
                      <FileType className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                          Word (.docx) • Infomaniak OnlyOffice
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white mt-1">
                        {pvFile.name}
                      </h4>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        Ce document est un fichier Word officiel. Vous pouvez l'ouvrir directement dans <strong>Infomaniak OnlyOffice</strong> pour une édition collaborative en temps réel avec toute la mise en page, logo et tableaux.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-blue-500/20 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">
                    Enregistrement automatique synchronisé sur kDrive
                  </span>

                  <a
                    href={pvFile.kdriveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all active:scale-95"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ouvrir dans OnlyOffice (kDrive)
                  </a>
                </div>
              </div>
            ) : null}

            {/* Document Ordre du Jour si présent en Word */}
            {odjFile && (
              <div className="mt-4 p-4 rounded-xl bg-slate-850/60 border border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      Ordre du jour de la séance
                    </p>
                    <p className="text-sm font-medium text-slate-200">{odjFile.name}</p>
                  </div>
                </div>

                {odjFile.kdriveUrl && (
                  <a
                    href={odjFile.kdriveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    <span>Consulter</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                )}
              </div>
            )}

            {/* Éditeur Enrichi avec Commandes Slash & Générateur Word */}
            {activeSession && (
              <div className="mt-6 pt-5 border-t border-slate-800">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-brand-400" />
                    <h4 className="text-sm font-bold text-white">
                      Éditeur de Séance & Générateur Word (.docx)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Tapez <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-brand-300 font-mono">/</kbd> pour les raccourcis, <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">@</kbd> pour les membres
                  </span>
                </div>

                <RichMeetingEditor
                  folderId={activeSession.id}
                  fileName={pvFile?.name || `${activeSession.name.replace(/\s+/g, '_')}_PV.docx`}
                  initialContent={
                    pvContent ||
                    `# Procès-Verbal • ${activeSession.name}\n\n**Date :** ${activeSession.name}\n**Lieu :** Salle du Conseil / Visio\n**Présents :** \n**Excusés :** \n\n---\n\n## 1. Méditation & Prière\n> **PRIÈRE :** \n\n## 2. Adoption de l'ordre du jour et approbation du dernier PV\n> **DÉCISION :** \n\n## 3. Points à l'ordre du jour\n\n`
                  }
                  meetingDate={activeSession.name}
                  docxTitle={`Procès-Verbal • ${activeSession.name}`}
                  docxUrl={pvFile?.kdriveUrl}
                  onSaved={() => {
                    loadFolderFiles();
                    fetchSessions();
                  }}
                />
              </div>
            )}

          </div>
        </div>

        {/* Colonne droite (4 cols) : Gestionnaire d'annexes kDrive */}
        <div className="lg:col-span-4 space-y-5">
          <div className="glass-card rounded-2xl border border-slate-800 p-5 flex flex-col h-full min-h-[550px]">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-brand-400" />
                <h3 className="font-bold text-sm text-white">Tous les Fichiers ({files.length})</h3>
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Documents et pièces jointes stockés sur kDrive pour cette séance.
            </p>

            {/* Zone Drag & Drop d'upload */}
            {activeSession && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFileUpload(e.dataTransfer.files);
                }}
                className={`p-4 rounded-xl border-2 border-dashed text-center transition-all cursor-pointer mb-4 ${
                  dragOver
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-slate-700/80 hover:border-slate-600 bg-slate-850/40'
                }`}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.onchange = (e: any) => handleFileUpload(e.target.files);
                  input.click();
                }}
              >
                <UploadCloud className="w-6 h-6 mx-auto text-brand-400 mb-1" />
                <p className="text-xs font-semibold text-slate-200">
                  {isUploading ? 'Téléversement en cours...' : 'Ajouter un document'}
                </p>
                <p className="text-[10px] text-slate-500">
                  Glisser ici un Word, PDF, image...
                </p>
              </div>
            )}

            {/* Liste des fichiers */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[460px]">
              {loadingFiles ? (
                <div className="py-8 text-center">
                  <Loader2 className="w-6 h-6 mx-auto text-brand-400 animate-spin" />
                </div>
              ) : files.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 italic">
                  Aucun fichier dans ce dossier kDrive.
                </div>
              ) : (
                files.map((file) => {
                  const isDoc = /\.(docx?)$/i.test(file.name);
                  const isPdf = /\.pdf$/i.test(file.name);

                  return (
                    <div
                      key={file.id}
                      className="p-3 rounded-xl bg-slate-850/60 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 truncate pr-2">
                        {isDoc ? (
                          <FileType className="w-4 h-4 text-blue-400 shrink-0" />
                        ) : isPdf ? (
                          <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                        ) : (
                          <File className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <div className="truncate">
                          <p className="text-slate-200 font-medium truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {file.size ? `${(file.size / 1024).toFixed(1)} Ko` : 'Fichier'}
                            {isDoc ? ' • Word OnlyOffice' : ''}
                          </p>
                        </div>
                      </div>

                      {file.kdriveUrl && (
                        <a
                          href={file.kdriveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-slate-400 hover:text-brand-300 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                          title={isDoc ? 'Ouvrir dans OnlyOffice' : 'Ouvrir dans kDrive'}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
