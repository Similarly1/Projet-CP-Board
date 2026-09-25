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
  Paperclip
} from 'lucide-react';
import { Meeting, KDriveFile } from '../types';
import { api } from '../services/api';
import { useToast } from './Toast';

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
  
  const [currentDate, setCurrentDate] = useState<string>(
    selectedMeetingDate || meetings[0]?.dateStr || new Date().toISOString().split('T')[0]
  );

  const activeMeeting = meetings.find((m) => m.dateStr === currentDate) || null;

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

  useEffect(() => {
    if (selectedMeetingDate) {
      setCurrentDate(selectedMeetingDate);
    }
  }, [selectedMeetingDate]);

  // Charger le contenu du PV s'il existe
  useEffect(() => {
    const fetchPv = async () => {
      if (activeMeeting?.kDrive?.pvFileId) {
        setLoadingPv(true);
        try {
          const content = await api.getFileContent(activeMeeting.kDrive.pvFileId);
          setPvContent(content);
          setHasUnsavedChanges(false);
        } catch (e: any) {
          console.error('Erreur lecture PV:', e);
        } finally {
          setLoadingPv(false);
        }
      } else {
        setPvContent('');
        setHasUnsavedChanges(false);
      }
    };

    fetchPv();
  }, [activeMeeting?.kDrive?.pvFileId]);

  // Charger les pièces jointes du dossier de séance
  const loadFolderFiles = async () => {
    if (activeMeeting?.kDrive?.folderId) {
      setLoadingFiles(true);
      try {
        const fileList = await api.getFolderFiles(activeMeeting.kDrive.folderId);
        setFiles(fileList);
      } catch (e) {
        console.error('Erreur chargement annexes:', e);
      } finally {
        setLoadingFiles(false);
      }
    } else {
      setFiles([]);
    }
  };

  useEffect(() => {
    loadFolderFiles();
  }, [activeMeeting?.kDrive?.folderId]);

  // Démarrer le PV (clonage ODJ)
  const handleStartPv = async () => {
    if (!activeMeeting?.kDrive?.folderId) {
      error("Le dossier de la séance n'est pas encore initialisé. Veuillez d'abord préparer la séance.");
      return;
    }

    setIsStartingPv(true);
    try {
      const res = await api.startPv({
        meetingDate: currentDate,
        folderId: activeMeeting.kDrive.folderId,
      });

      success(res.alreadyExisted ? 'Procès-verbal chargé !' : 'Procès-verbal initialisé depuis l ODJ !');
      setPvContent(res.content);
      setHasUnsavedChanges(false);
      onRefreshMeetings();
      loadFolderFiles();
    } catch (err: any) {
      error(err.message || 'Erreur lors du démarrage du PV');
    } finally {
      setIsStartingPv(false);
    }
  };

  // Enregistrer le PV sur kDrive
  const handleSavePv = async () => {
    if (!activeMeeting?.kDrive?.pvFileId) return;

    setSavingPv(true);
    try {
      await api.saveFileContent({
        fileId: activeMeeting.kDrive.pvFileId,
        content: pvContent,
        parentFolderId: activeMeeting.kDrive.folderId,
        fileName: `${currentDate}_PV.md`,
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
    if (!activeMeeting?.kDrive?.folderId) {
      error('Dossier kDrive non initialisé.');
      return;
    }

    const file = fileList[0];
    setIsUploading(true);

    try {
      await api.uploadFile(activeMeeting.kDrive.folderId, file);
      success(`Fichier "${file.name}" téléversé avec succès sur kDrive !`);
      loadFolderFiles();
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
            Rédaction du PV en séance et gestion des pièces jointes hébergées sur kDrive
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 font-medium whitespace-nowrap">
            Séance active :
          </label>
          <select
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {meetings.map((m) => (
              <option key={m.id} value={m.dateStr}>
                {m.dateStr} - {m.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Grille principale : Rédacteur de PV (8 cols) & Pièces jointes kDrive (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Colonne gauche (8 cols) : Éditeur PV */}
        <div className="lg:col-span-8">
          <div className="glass-card rounded-2xl border border-slate-800 p-5 flex flex-col h-full min-h-[620px]">
            
            {/* Header de l'éditeur */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">
                  {currentDate}_PV.md
                </h3>
                {hasUnsavedChanges && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                    Modifications non enregistrées
                  </span>
                )}
              </div>

              {activeMeeting?.kDrive?.pvFileId && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSavePv}
                    disabled={savingPv || !hasUnsavedChanges}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-all shadow-md shadow-emerald-600/20"
                  >
                    {savingPv ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Enregistrer le PV
                  </button>
                </div>
              )}
            </div>

            {/* Contenu */}
            {!activeMeeting?.kDrive?.hasFolder ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-850/40 rounded-xl border border-slate-800/80">
                <Calendar className="w-12 h-12 text-slate-600 mb-3" />
                <h4 className="text-base font-semibold text-white mb-1">
                  Dossier de séance non initialisé
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mb-4">
                  Rendez-vous dans l'onglet "Préparation & ODJ" pour créer le dossier et l'ordre du jour sur kDrive avant de démarrer le PV.
                </p>
              </div>
            ) : !activeMeeting?.kDrive?.pvFileId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-850/40 rounded-xl border border-slate-800/80">
                <Play className="w-12 h-12 text-indigo-400 mb-3" />
                <h4 className="text-base font-semibold text-white mb-1">
                  Prêt à démarrer le procès-verbal
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mb-4">
                  Un clic sur "Démarrer le PV" va dupliquer automatiquement l'Ordre du Jour existant vers un nouveau fichier <span className="font-mono text-indigo-300">{currentDate}_PV.md</span>.
                </p>
                <button
                  onClick={handleStartPv}
                  disabled={isStartingPv}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
                >
                  {isStartingPv ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Clonage de l'ODJ...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Démarrer le PV
                    </>
                  )}
                </button>
              </div>
            ) : loadingPv ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <textarea
                  value={pvContent}
                  onChange={(e) => {
                    setPvContent(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Prenez des notes de décisions, adoption des points..."
                  className="flex-1 w-full p-4 bg-slate-900 border border-slate-850 rounded-xl font-mono text-xs sm:text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none leading-relaxed"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
                  <span>{pvContent.split(/\s+/).filter(Boolean).length} mots</span>
                  <span>Sauvegarde manuelle anti rate-limiting kDrive</span>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Colonne droite (4 cols) : Gestionnaire d'annexes kDrive */}
        <div className="lg:col-span-4 space-y-5">
          <div className="glass-card rounded-2xl border border-slate-800 p-5 flex flex-col h-full min-h-[620px]">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-brand-400" />
                <h3 className="font-bold text-sm text-white">Annexes & Fichiers</h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {files.length}
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Pièces jointes stockées directement dans le dossier kDrive de la séance.
            </p>

            {/* Zone Drag & Drop d'upload */}
            {activeMeeting?.kDrive?.hasFolder && (
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
                className={`p-5 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer mb-4 ${
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
                <UploadCloud className="w-8 h-8 mx-auto text-brand-400 mb-1.5" />
                <p className="text-xs font-semibold text-slate-200">
                  {isUploading ? 'Téléversement en cours...' : 'Glisser un fichier ici'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  PDF, tableur, images (max 50 Mo)
                </p>
              </div>
            )}

            {/* Liste des fichiers */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loadingFiles ? (
                <div className="py-8 text-center">
                  <Loader2 className="w-6 h-6 mx-auto text-brand-400 animate-spin" />
                </div>
              ) : files.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 italic">
                  Aucun fichier dans ce dossier kDrive.
                </div>
              ) : (
                files.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 rounded-xl bg-slate-850/60 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 truncate pr-2">
                      <File className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="truncate">
                        <p className="text-slate-200 font-medium truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {file.size ? `${(file.size / 1024).toFixed(1)} Ko` : 'Dossier'}
                        </p>
                      </div>
                    </div>

                    {file.kdriveUrl && (
                      <a
                        href={file.kdriveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-slate-400 hover:text-brand-300 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                        title="Ouvrir dans kDrive"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
