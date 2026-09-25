import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  FileText,
  FileCheck,
  AlertCircle,
  Plus,
  ExternalLink,
  ChevronRight,
  User,
  CheckCircle2,
  Paperclip,
  Upload,
  Edit,
  Eye,
  Columns,
  RefreshCw,
  FolderPlus,
  Loader2,
  Send,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { MeetingSummary, MeetingDetails, CommitteeMember, KDriveFile } from '../types';
import { api } from '../services/api';
import { useToast } from './Toast';
import { RichMeetingEditor } from './RichMeetingEditor';

export const UnifiedMeetingsTab: React.FC = () => {
  const { success, error, info } = useToast();

  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | number | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<MeetingDetails | null>(null);
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>([]);

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'both' | 'oj' | 'pv' | 'files'>('both');

  // Modale nouvelle séance
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMeetingDate, setNewMeetingDate] = useState('');
  const [newMeetingTopic, setNewMeetingTopic] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Édition Ordre du Jour
  const [isEditingOj, setIsEditingOj] = useState(false);
  const [ojDraft, setOjDraft] = useState('');
  const [isSavingOj, setIsSavingOj] = useState(false);

  // Upload annexe
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Chargement initial
  useEffect(() => {
    loadMeetings();
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const members = await api.getCommitteeMembers();
      setCommitteeMembers(members);
    } catch (e) {
      console.warn('Erreur chargement membres:', e);
    }
  };

  const loadMeetings = async () => {
    setIsLoadingList(true);
    try {
      const list = await api.getMeetingsList(2026);
      setMeetings(list);

      // Sélectionne par défaut la dernière séance tenue avec dossier (ex: CP 09.24)
      if (list.length > 0 && !selectedMeetingId) {
        const latestWithFolder = list.find((m) => m.folderId) || list[0];
        selectMeeting(latestWithFolder);
      }
    } catch (err: any) {
      error(`Erreur chargement des réunions: ${err.message}`);
    } finally {
      setIsLoadingList(false);
    }
  };

  const selectMeeting = async (meetingOrId: MeetingSummary | string | number) => {
    let meeting: MeetingSummary | undefined;
    if (typeof meetingOrId === 'object' && meetingOrId !== null) {
      meeting = meetingOrId;
    } else {
      meeting = meetings.find((x) => String(x.folderId) === String(meetingOrId) || x.dateStr === String(meetingOrId));
    }

    if (!meeting) {
      if (typeof meetingOrId === 'string' || typeof meetingOrId === 'number') {
        setSelectedMeetingId(meetingOrId);
        setIsLoadingDetails(true);
        try {
          const details = await api.getMeetingDetails(meetingOrId);
          setSelectedDetails(details);
          setOjDraft(details.ojContent || generateDefaultOj(details));
        } catch (err: any) {
          error(`Erreur chargement de la séance: ${err.message}`);
        } finally {
          setIsLoadingDetails(false);
        }
      }
      return;
    }

    setSelectedMeetingId(meeting.folderId || meeting.dateStr);
    setIsEditingOj(false);

    if (meeting.folderId) {
      setIsLoadingDetails(true);
      try {
        const details = await api.getMeetingDetails(meeting.folderId);
        setSelectedDetails(details);
        setOjDraft(details.ojContent || generateDefaultOj(details));
      } catch (err: any) {
        error(`Erreur chargement de la séance: ${err.message}`);
      } finally {
        setIsLoadingDetails(false);
      }
    } else {
      // Séance planifiée sans dossier kDrive créé pour l'instant
      const defaultOj = generateDefaultOj(meeting);
      setSelectedDetails({
        folderName: meeting.folderName,
        dateStr: meeting.dateStr,
        year: meeting.year,
        displayTitle: meeting.displayTitle,
        hasOj: false,
        hasPv: false,
        attachmentsCount: 0,
        churchToolsAppointment: meeting.churchToolsAppointment,
        isUpcoming: true,
        ojContent: defaultOj,
        pvContent: '',
        files: [],
        preparationNotes: [],
      });
      setOjDraft(defaultOj);
    }
  };

  const generateDefaultOj = (details: MeetingDetails | MeetingSummary) => {
    const parts = (details.dateStr || '').split('-');
    const formattedDate = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : details.dateStr;
    const membersList = committeeMembers.length > 0
      ? committeeMembers.map((m) => `- ${m.displayName} (${m.mentionName})`).join('\n')
      : '- Adrien (AO)\n- Jean-Marc (JMo)\n- Tom (TV)\n- Sébastien V. (SV)\n- Albin (AW)';

    return `OJ - CP\n\n${formattedDate} de 20h00 à 22h00\nSalle club Biblique\n\nPrésident : ${details.president || 'Adrien (AO)'}\nPV : ${details.secretary || 'Jean-Marc (JMo)'}\n\nParticipants prévus :\n${membersList}\n\n## Points à l'ordre du jour\n1. Accueil et prière\n2. Revue et approbation du dernier PV\n3. Suivis des tâches en cours\n4. Sujets pastoraux\n5. Divers et clôture`;
  };

  // Trouver la prochaine rencontre (la plus proche dans le futur >= aujourd'hui)
  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingMeetings = meetings
    .filter((m) => m.dateStr >= todayStr)
    .sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  const nextMeeting = upcomingMeetings[0] || meetings[0];

  const handleCreateMeetingFolder = async (dateStr: string, topic?: string) => {
    if (!dateStr) return;
    setIsCreatingFolder(true);
    try {
      const res = await api.createMeetingFolder({ dateStr, topic });
      success(`Dossier kDrive "${res.folder?.name}" créé avec succès !`);
      setShowCreateModal(false);
      setNewMeetingDate('');
      setNewMeetingTopic('');
      await loadMeetings();
      if (res.folder?.id) {
        selectMeeting({
          folderId: res.folder.id,
          folderName: res.folder.name,
          dateStr,
          year: 2026,
          displayTitle: res.folder.name,
          hasOj: false,
          hasPv: false,
          attachmentsCount: 0,
          isUpcoming: true,
        });
      }
    } catch (err: any) {
      error(`Erreur création dossier: ${err.message}`);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleSaveOj = async () => {
    if (!selectedDetails) return;
    let targetFolderId = selectedDetails.folderId;

    setIsSavingOj(true);
    try {
      // Si pas encore de dossier kDrive, on le crée d'abord !
      if (!targetFolderId) {
        const res = await api.createMeetingFolder({ dateStr: selectedDetails.dateStr });
        targetFolderId = res.folder.id;
      }

      await api.saveMeetingOj(targetFolderId!, {
        content: ojDraft,
        meetingDate: selectedDetails.dateStr,
      });
      success('Ordre du jour sauvegardé et exporté en Word (.docx) sur kDrive !');
      setIsEditingOj(false);
      await loadMeetings();
      selectMeeting({
        folderId: targetFolderId!,
        folderName: selectedDetails.folderName,
        dateStr: selectedDetails.dateStr,
        year: selectedDetails.year,
        displayTitle: selectedDetails.displayTitle,
        hasOj: true,
        hasPv: false,
        attachmentsCount: 1,
        isUpcoming: selectedDetails.isUpcoming,
      });
    } catch (err: any) {
      error(`Erreur sauvegarde OJ: ${err.message}`);
    } finally {
      setIsSavingOj(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDetails?.folderId) return;

    setIsUploadingFile(true);
    try {
      await api.uploadAttachment(selectedDetails.folderId!, file);
      success(`Annexe "${file.name}" ajoutée au dossier kDrive !`);
      selectMeeting(selectedDetails.folderId!);
    } catch (err: any) {
      error(`Erreur téléversement: ${err.message}`);
    } finally {
      setIsUploadingFile(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HERO SECTION : PROCHAINE RENCONTRE EN VEDETTE */}
      {nextMeeting && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/70 to-slate-900 border border-indigo-500/20 shadow-xl p-6">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Calendar className="w-3.5 h-3.5" />
                  Prochaine Rencontre
                </span>
                {nextMeeting.hasOj ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    OJ Établi
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <AlertCircle className="w-3 h-3" />
                    OJ en attente
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {nextMeeting.displayTitle}
                </h2>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    {nextMeeting.churchToolsAppointment?.startDate
                      ? new Date(nextMeeting.churchToolsAppointment.startDate).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : nextMeeting.dateStr}
                  </span>
                  {nextMeeting.churchToolsAppointment?.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-indigo-400" />
                      {nextMeeting.churchToolsAppointment.location}
                    </span>
                  )}
                  <span className="text-slate-400 text-xs px-2 py-0.5 bg-slate-800 rounded">
                    Dossier kDrive : <strong className="text-indigo-200">{nextMeeting.folderName}</strong>
                  </span>
                </div>
              </div>

              {/* Rôles Président & Secrétaire */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-lg text-xs">
                  <span className="text-slate-400">Président :</span>
                  <strong className="text-indigo-300">
                    {nextMeeting.president || 'À désigner'}
                  </strong>
                </div>
                <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-lg text-xs">
                  <span className="text-slate-400">Secrétaire (PV) :</span>
                  <strong className="text-indigo-300">
                    {nextMeeting.secretary || 'À désigner'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Actions rapides */}
            <div className="flex flex-wrap items-center gap-3">
              {nextMeeting.folderId ? (
                <button
                  onClick={() => selectMeeting(nextMeeting)}
                  className="px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Ouvrir cette séance
                </button>
              ) : (
                <button
                  onClick={() => handleCreateMeetingFolder(nextMeeting.dateStr)}
                  disabled={isCreatingFolder}
                  className="px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2"
                >
                  {isCreatingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                  Créer le dossier {nextMeeting.folderName} sur kDrive
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. CORPS PRINCIPAL : DEUX VOLETS MASTER-DETAIL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* VOLET GAUCHE (4 colonnes) : LISTE CHRONOLOGIQUE DES SÉANCES */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              Toutes les Séances (2026)
            </h3>
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-1.5 rounded-lg text-xs text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all flex items-center gap-1"
              title="Ajouter une nouvelle séance"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau</span>
            </button>
          </div>

          {isLoadingList ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
              {meetings.map((m) => {
                const isSelected =
                  selectedMeetingId &&
                  ((m.folderId && String(selectedMeetingId) === String(m.folderId)) ||
                    String(selectedMeetingId) === m.dateStr);
                return (
                  <div
                    key={m.folderId || m.dateStr}
                    onClick={() => selectMeeting(m)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500 shadow-md shadow-indigo-500/10'
                        : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm text-white flex items-center gap-2">
                        <span>{m.folderName}</span>
                        {m.isUpcoming && (
                          <span className="w-2 h-2 rounded-full bg-indigo-400" title="Séance future" />
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        {m.dateStr.split('-').slice(1).reverse().join('.')}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 truncate mt-1">
                      {m.displayTitle}
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-800/80 text-xs">
                      {/* Badges OJ / PV / Pièces jointes */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            m.hasOj
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          OJ
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            m.hasPv
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          PV
                        </span>
                        {m.attachmentsCount > 0 && (
                          <span className="flex items-center gap-0.5 text-slate-400 text-[11px]">
                            <Paperclip className="w-3 h-3" />
                            {m.attachmentsCount}
                          </span>
                        )}
                      </div>

                      {/* Rôles ou bouton création */}
                      {m.folderId ? (
                        <div className="text-[11px] text-slate-400">
                          {m.president ? `👑 ${m.president.split(' ')[0]}` : ''}
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateMeetingFolder(m.dateStr);
                          }}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 underline font-medium"
                        >
                          + Créer dossier
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* VOLET DROIT (8 colonnes) : EN UN COUP D'ŒIL (OJ & PV) */}
        <div className="lg:col-span-8 space-y-4">
          {isLoadingDetails ? (
            <div className="flex flex-col items-center justify-center p-20 bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-3" />
              <span>Chargement des documents de la séance...</span>
            </div>
          ) : selectedDetails ? (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-5">
              {/* En-tête de la séance sélectionnée */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">
                      {selectedDetails.displayTitle}
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">
                      {selectedDetails.folderName}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400">
                    <span>Date : <strong className="text-slate-200">{selectedDetails.dateStr}</strong></span>
                    <span>•</span>
                    <span>Président : <strong className="text-indigo-300">{selectedDetails.president || 'Non spécifié'}</strong></span>
                    <span>•</span>
                    <span>Secrétaire : <strong className="text-indigo-300">{selectedDetails.secretary || 'Non spécifié'}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedDetails.kdriveUrl && (
                    <a
                      href={selectedDetails.kdriveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Ouvrir sur kDrive</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Notification séance planifiée sans dossier kDrive */}
              {!selectedDetails.folderId && (
                <div className="p-4 rounded-xl bg-indigo-950/60 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <FolderPlus className="w-5 h-5 text-indigo-400 shrink-0" />
                    <div className="text-xs">
                      <p className="font-semibold text-white">Cette séance est planifiée dans ChurchTools mais son dossier kDrive n'existe pas encore.</p>
                      <p className="text-slate-400 mt-0.5">Vous pouvez pré-rédiger l'Ordre du Jour ci-dessous, puis créer le dossier officiel kDrive d'un simple clic.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCreateMeetingFolder(selectedDetails.dateStr)}
                    disabled={isCreatingFolder}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-2 whitespace-nowrap shadow-lg shadow-emerald-600/20 transition-all shrink-0"
                  >
                    {isCreatingFolder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5" />}
                    Créer le dossier {selectedDetails.folderName} sur kDrive
                  </button>
                </div>
              )}

              {/* Barre de navigation interne (Sous-onglets) */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveSubTab('both')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                      activeSubTab === 'both'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5" />
                    <span>Vue Côte-à-Côte (OJ & PV)</span>
                  </button>
                  <button
                    onClick={() => setActiveSubTab('oj')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                      activeSubTab === 'oj'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Ordre du Jour (OJ)</span>
                  </button>
                  <button
                    onClick={() => setActiveSubTab('pv')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                      activeSubTab === 'pv'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Procès-Verbal (PV)</span>
                  </button>
                  <button
                    onClick={() => setActiveSubTab('files')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                      activeSubTab === 'files'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Annexes & Fichiers ({selectedDetails.files?.length || 0})</span>
                  </button>
                </div>
              </div>

              {/* CONTENU SELON LE MODE CHOISI */}
              {/* MODE 1 : VUE CÔTE-À-CÔTE (EN UN COUP D'ŒIL) */}
              {activeSubTab === 'both' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* COLONNE GAUCHE : ORDRE DU JOUR (OJ) */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col h-[650px]">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-sm font-semibold text-white">Ordre du Jour</h4>
                        {selectedDetails.ojFileName && (
                          <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            ({selectedDetails.ojFileName})
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setIsEditingOj(!isEditingOj)}
                        className="text-xs text-indigo-300 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
                      >
                        {isEditingOj ? 'Aperçu' : 'Modifier'}
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 text-sm text-slate-300">
                      {isEditingOj ? (
                        <div className="flex flex-col h-full space-y-2">
                          <textarea
                            value={ojDraft}
                            onChange={(e) => setOjDraft(e.target.value)}
                            className="flex-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-200 resize-none focus:outline-none focus:border-indigo-500"
                            placeholder="Contenu de l'Ordre du Jour..."
                          />
                          <button
                            onClick={handleSaveOj}
                            disabled={isSavingOj}
                            className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2"
                          >
                            {isSavingOj ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5" />}
                            Enregistrer & Compiler Word (.docx)
                          </button>
                        </div>
                      ) : selectedDetails.ojContent ? (
                        <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed space-y-2 text-slate-200">
                          {selectedDetails.ojContent}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
                          <AlertCircle className="w-8 h-8 text-amber-400/80 mb-2" />
                          <p className="text-xs mb-3">Aucun Ordre du Jour trouvé pour cette séance.</p>
                          <button
                            onClick={() => {
                              setIsEditingOj(true);
                              setOjDraft(generateDefaultOj(selectedDetails));
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500"
                          >
                            Créer avec le modèle standard
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* COLONNE DROITE : PROCÈS-VERBAL (PV) AVEC ÉDITEUR RICHE */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col h-[650px]">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                      <div className="flex items-center gap-2">
                        <Edit className="w-4 h-4 text-indigo-400" />
                        <h4 className="text-sm font-semibold text-white">Procès-Verbal</h4>
                      </div>
                      <span className="text-[10px] text-slate-400">Commandes / et tags @ actifs</span>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                      <RichMeetingEditor
                        folderId={selectedDetails.folderId!}
                        fileName={selectedDetails.pvFileName || `PV - ${selectedDetails.folderName}.md`}
                        initialContent={selectedDetails.pvContent || `# Procès-Verbal - Séance ${selectedDetails.folderName}\n\n**Date :** ${selectedDetails.dateStr}\n**Président :** ${selectedDetails.president || 'AO'}\n**PV :** ${selectedDetails.secretary || 'JMo'}\n\n## 1. Accueil & Prière\n\n## 2. Décisions & Actions\n- [ ] `}
                        meetingDate={selectedDetails.dateStr}
                        docxTitle={`Procès-Verbal - ${selectedDetails.displayTitle}`}
                        docxUrl={selectedDetails.files?.find((f) => /^pv.*\.docx$/i.test(f.name))?.kdriveUrl}
                        onSaved={() => selectedDetails.folderId && selectMeeting(selectedDetails.folderId)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 2 : VUE EXCLUSIVE ORDRE DU JOUR (OJ) */}
              {activeSubTab === 'oj' && (
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-400" />
                      <h3 className="font-semibold text-white text-base">Ordre du Jour</h3>
                    </div>
                    <button
                      onClick={() => setIsEditingOj(!isEditingOj)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 flex items-center gap-1.5"
                    >
                      {isEditingOj ? 'Mode Lecture' : 'Modifier le contenu'}
                    </button>
                  </div>

                  {isEditingOj ? (
                    <div className="space-y-3">
                      <textarea
                        value={ojDraft}
                        onChange={(e) => setOjDraft(e.target.value)}
                        rows={16}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm font-mono text-slate-200 resize-y focus:outline-none focus:border-indigo-500"
                        placeholder="Rédigez l'Ordre du Jour..."
                      />
                      <button
                        onClick={handleSaveOj}
                        disabled={isSavingOj}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm flex items-center gap-2"
                      >
                        {isSavingOj ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                        Enregistrer & Compiler Word (.docx) sur kDrive
                      </button>
                    </div>
                  ) : (
                    <div className="p-5 bg-slate-900/50 rounded-xl border border-slate-800/60 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                      {selectedDetails.ojContent || 'Aucun Ordre du Jour rédigé.'}
                    </div>
                  )}
                </div>
              )}

              {/* MODE 3 : VUE EXCLUSIVE PROCÈS-VERBAL (PV) */}
              {activeSubTab === 'pv' && (
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-5">
                  <RichMeetingEditor
                    folderId={selectedDetails.folderId!}
                    fileName={selectedDetails.pvFileName || `PV - ${selectedDetails.folderName}.md`}
                    initialContent={selectedDetails.pvContent || `# Procès-Verbal - Séance ${selectedDetails.folderName}\n\n**Date :** ${selectedDetails.dateStr}\n**Président :** ${selectedDetails.president || 'AO'}\n**PV :** ${selectedDetails.secretary || 'JMo'}\n\n## 1. Accueil & Prière\n\n## 2. Décisions & Actions\n- [ ] `}
                    meetingDate={selectedDetails.dateStr}
                    docxTitle={`Procès-Verbal - ${selectedDetails.displayTitle}`}
                    docxUrl={selectedDetails.files?.find((f) => /^pv.*\.docx$/i.test(f.name))?.kdriveUrl}
                    onSaved={() => selectedDetails.folderId && selectMeeting(selectedDetails.folderId)}
                  />
                </div>
              )}

              {/* MODE 4 : VUE FICHIERS & ANNEXES DU DOSSIER */}
              {activeSubTab === 'files' && (
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white text-base flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-indigo-400" />
                        Documents du dossier ({selectedDetails.files?.length || 0})
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Tous les fichiers (PV, OJ, PDF, annexes) hébergés dans le dossier {selectedDetails.folderName}
                      </p>
                    </div>

                    <label className="cursor-pointer px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 flex items-center gap-1.5 transition-all">
                      {isUploadingFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      <span>Téléverser une annexe</span>
                      <input type="file" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {selectedDetails.files?.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-all"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                          <div className="truncate">
                            <div className="text-xs font-medium text-white truncate">{f.name}</div>
                            <div className="text-[10px] text-slate-400">
                              {f.size ? `${(f.size / 1024).toFixed(1)} Ko` : ''}
                            </div>
                          </div>
                        </div>

                        {f.kdriveUrl && (
                          <a
                            href={f.kdriveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                            title="Ouvrir sur kDrive"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-20 bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400">
              <Calendar className="w-10 h-10 text-slate-600 mb-3" />
              <span>Sélectionnez une séance dans la colonne de gauche pour afficher son Ordre du Jour et son PV.</span>
            </div>
          )}
        </div>
      </div>

      {/* MODALE CRÉATION DOSSIER DE SÉANCE */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-indigo-400" />
              Nouvelle séance Comité
            </h3>
            <p className="text-xs text-slate-400">
              Un dossier standard <strong className="text-indigo-300">CP MM.DD</strong> sera automatiquement créé sur kDrive dans le dossier 2026.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Date de la séance *</label>
                <input
                  type="date"
                  value={newMeetingDate}
                  onChange={(e) => setNewMeetingDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Thème ou précision (optionnel)</label>
                <input
                  type="text"
                  value={newMeetingTopic}
                  onChange={(e) => setNewMeetingTopic(e.target.value)}
                  placeholder="Ex: Rencontre pastorale, Budget 2027..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700"
              >
                Annuler
              </button>
              <button
                onClick={() => handleCreateMeetingFolder(newMeetingDate, newMeetingTopic)}
                disabled={!newMeetingDate || isCreatingFolder}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isCreatingFolder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Créer le dossier kDrive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
