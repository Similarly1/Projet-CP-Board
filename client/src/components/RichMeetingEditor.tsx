import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Save,
  ExternalLink,
  Loader2,
  Check,
  CheckSquare,
  Heading1,
  Heading2,
  Heading3,
  List,
  Quote,
  AtSign,
  HeartHandshake,
  Sparkles,
  Eye,
  Edit3,
  HelpCircle,
  FileDown,
  Maximize2,
  Minimize2,
  BookOpen
} from 'lucide-react';
import { CommitteeMember } from '../types';
import { api } from '../services/api';
import { useToast } from './Toast';

interface RichMeetingEditorProps {
  folderId: string | number;
  fileName: string;
  initialContent: string;
  meetingDate?: string;
  docxTitle?: string;
  docxUrl?: string;
  ojMemoContent?: string;
  onSaved?: () => void;
}

interface SlashCommand {
  id: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  template: string;
}

export const RichMeetingEditor: React.FC<RichMeetingEditorProps> = ({
  folderId,
  fileName,
  initialContent,
  meetingDate,
  docxTitle,
  docxUrl,
  ojMemoContent,
  onSaved,
}) => {
  const { success, error } = useToast();
  
  const [content, setContent] = useState(initialContent || '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syncTasks, setSyncTasks] = useState(true);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOjMemo, setShowOjMemo] = useState(false);

  // Écoute de la touche Échap pour quitter le mode plein écran
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Membres du CP
  const [members, setMembers] = useState<CommitteeMember[]>([]);

  // Menus flottants
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashSearch, setSlashSearch] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);

  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Charger les membres du CP
  useEffect(() => {
    const loadMembers = async () => {
      try {
        const list = await api.getCommitteeMembers();
        setMembers(list);
      } catch (e) {
        console.error('Erreur chargement membres CP:', e);
      }
    };
    loadMembers();
  }, []);

  useEffect(() => {
    setContent(initialContent || '');
    setHasUnsavedChanges(false);
  }, [initialContent]);

  // Commandes Slash
  const slashCommands: SlashCommand[] = [
    {
      id: 'h1',
      label: 'Titre 1',
      desc: 'Grand titre de section',
      icon: <Heading1 className="w-4 h-4 text-brand-400" />,
      template: '# ',
    },
    {
      id: 'h2',
      label: 'Titre 2',
      desc: 'Point d\'ordre du jour',
      icon: <Heading2 className="w-4 h-4 text-sky-400" />,
      template: '## ',
    },
    {
      id: 'h3',
      label: 'Titre 3',
      desc: 'Sous-point',
      icon: <Heading3 className="w-4 h-4 text-indigo-400" />,
      template: '### ',
    },
    {
      id: 'task',
      label: 'Tâche administrative',
      desc: 'Ajoute une action synchronisée (- [ ])',
      icon: <CheckSquare className="w-4 h-4 text-emerald-400" />,
      template: `- [ ] Intitulé de l'action | @Assigné | ${new Date().toISOString().split('T')[0]} | Réf: ${meetingDate || ''}\n`,
    },
    {
      id: 'decision',
      label: 'Décision / Résolution',
      desc: 'Encadré officiel de décision',
      icon: <Quote className="w-4 h-4 text-blue-400" />,
      template: '> **DÉCISION :** ',
    },
    {
      id: 'prayer',
      label: 'Prière / Partage',
      desc: 'Temps d\'intercession et de prière',
      icon: <HeartHandshake className="w-4 h-4 text-purple-400" />,
      template: '> **PRIÈRE :** ',
    },
    {
      id: 'bullet',
      label: 'Liste à puces',
      desc: 'Point de discussion simple',
      icon: <List className="w-4 h-4 text-slate-400" />,
      template: '- ',
    },
  ];

  const filteredSlash = slashCommands.filter((c) =>
    c.label.toLowerCase().includes(slashSearch.toLowerCase()) ||
    c.desc.toLowerCase().includes(slashSearch.toLowerCase())
  );

  const filteredMembers = members.filter((m) =>
    m.displayName.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    m.mentionName.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // Gestion des touches dans le textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Si le menu slash est ouvert
    if (slashMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((prev) => (prev + 1) % filteredSlash.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((prev) => (prev - 1 + filteredSlash.length) % filteredSlash.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredSlash[slashIndex]) {
          applySlashCommand(filteredSlash[slashIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        setSlashMenuOpen(false);
        return;
      }
    }

    // Si le menu mention est ouvert
    if (mentionMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredMembers[mentionIndex]) {
          applyMention(filteredMembers[mentionIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        setMentionMenuOpen(false);
        return;
      }
    }

    // Déclencheurs Slash / et Mention @
    if (e.key === '/') {
      setSlashMenuOpen(true);
      setSlashSearch('');
      setSlashIndex(0);
    } else if (e.key === '@') {
      setMentionMenuOpen(true);
      setMentionSearch('');
      setMentionIndex(0);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    setHasUnsavedChanges(true);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    
    // Détection de recherche pour slash command
    const lastSlash = textBeforeCursor.lastIndexOf('/');
    if (lastSlash !== -1 && lastSlash >= textBeforeCursor.lastIndexOf('\n')) {
      const query = textBeforeCursor.slice(lastSlash + 1);
      if (!query.includes(' ')) {
        setSlashMenuOpen(true);
        setSlashSearch(query);
        setSlashIndex(0);
      } else {
        setSlashMenuOpen(false);
      }
    } else {
      setSlashMenuOpen(false);
    }

    // Détection de recherche pour mention @
    const lastAt = textBeforeCursor.lastIndexOf('@');
    if (lastAt !== -1 && lastAt >= textBeforeCursor.lastIndexOf(' ') && lastAt >= textBeforeCursor.lastIndexOf('\n')) {
      const query = textBeforeCursor.slice(lastAt + 1);
      setMentionMenuOpen(true);
      setMentionSearch(query);
      setMentionIndex(0);
    } else {
      setMentionMenuOpen(false);
    }
  };

  // Insérer commande slash
  const applySlashCommand = (cmd: SlashCommand) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const pos = textarea.selectionStart;
    const textBefore = content.slice(0, pos);
    const lastSlash = textBefore.lastIndexOf('/');
    const textAfter = content.slice(pos);

    const prefix = lastSlash !== -1 ? content.slice(0, lastSlash) : textBefore;
    const newContent = `${prefix}${cmd.template}${textAfter}`;

    setContent(newContent);
    setHasUnsavedChanges(true);
    setSlashMenuOpen(false);

    setTimeout(() => {
      textarea.focus();
      const newPos = prefix.length + cmd.template.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 10);
  };

  // Insérer mention membre
  const applyMention = (member: CommitteeMember) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const pos = textarea.selectionStart;
    const textBefore = content.slice(0, pos);
    const lastAt = textBefore.lastIndexOf('@');
    const textAfter = content.slice(pos);

    const prefix = lastAt !== -1 ? content.slice(0, lastAt) : textBefore;
    const inserted = `@${member.mentionName} `;
    const newContent = `${prefix}${inserted}${textAfter}`;

    setContent(newContent);
    setHasUnsavedChanges(true);
    setMentionMenuOpen(false);

    setTimeout(() => {
      textarea.focus();
      const newPos = prefix.length + inserted.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 10);
  };

  // Insertion depuis la barre d'outils
  const insertToolbarSnippet = (snippet: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);
    const replacement = selected ? `${snippet}${selected}` : snippet;
    const newContent = `${content.slice(0, start)}${replacement}${content.slice(end)}`;

    setContent(newContent);
    setHasUnsavedChanges(true);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + replacement.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 10);
  };

  // Sauvegarder & Générer le document Word .docx sur kDrive
  const handleSaveAndExportDocx = async () => {
    setIsSaving(true);
    try {
      const res = await api.saveAndExportDocx({
        folderId,
        fileName,
        content,
        docxTitle: docxTitle || `Procès-Verbal de Séance • ${meetingDate || ''}`,
        meetingDate,
        syncTasks,
      });

      success(
        res.syncedTaskCount > 0
          ? `Enregistré ! Document Word généré sur kDrive & ${res.syncedTaskCount} tâche(s) synchronisée(s).`
          : `Enregistré ! Document Word (.docx) généré et synchronisé sur kDrive.`
      );
      setHasUnsavedChanges(false);
      if (onSaved) onSaved();
    } catch (err: any) {
      error(err.message || 'Erreur lors de la sauvegarde et génération Word sur kDrive');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col p-4 sm:p-6 overflow-hidden'
          : 'flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl'
      }
    >
      
      {/* 1. Barre d'outils supérieure */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        
        {/* Raccourcis de formatage rapides */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => insertToolbarSnippet('\n# ')}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-xs font-bold"
            title="Titre 1 (#)"
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => insertToolbarSnippet('\n## ')}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-xs font-bold"
            title="Titre 2 (##)"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => insertToolbarSnippet('\n### ')}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-xs font-bold"
            title="Titre 3 (###)"
          >
            H3
          </button>

          <span className="w-px h-4 bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={() => insertToolbarSnippet(`\n- [ ] Action | @${members[0]?.mentionName || 'Assigné'} | ${meetingDate || ''}\n`)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/50 transition-colors"
            title="Insérer une tâche administrative (- [ ])"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Tâche</span>
          </button>

          <button
            type="button"
            onClick={() => insertToolbarSnippet('\n> **DÉCISION :** ')}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-blue-300 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/50 transition-colors"
            title="Insérer une décision adoptée"
          >
            <Quote className="w-3.5 h-3.5" />
            <span>Décision</span>
          </button>

          <button
            type="button"
            onClick={() => insertToolbarSnippet('\n> **PRIÈRE :** ')}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-purple-300 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/50 transition-colors"
            title="Insérer un temps de prière / méditation"
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Prière</span>
          </button>

          {/* Raccourci Membre @ */}
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/50 transition-colors"
            >
              <AtSign className="w-3.5 h-3.5" />
              <span>Membre CP</span>
            </button>
            <div className="hidden group-hover:block absolute left-0 top-full mt-1 w-44 rounded-xl bg-slate-850 border border-slate-700 shadow-xl py-1 z-30">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => insertToolbarSnippet(`@${m.mentionName} `)}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 flex items-center justify-between"
                >
                  <span>{m.displayName}</span>
                  <span className="text-[10px] text-slate-400 font-mono">@{m.mentionName}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions & Sauvegarde */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Synchroniser les tâches auto */}
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={syncTasks}
              onChange={(e) => setSyncTasks(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 text-brand-600 focus:ring-0"
            />
            <span className="hidden md:inline">Sync tâches kDrive</span>
          </label>

          {/* Bascule Vue brut / Aperçu stylisé */}
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            {viewMode === 'edit' ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            <span>{viewMode === 'edit' ? 'Aperçu' : 'Édition'}</span>
          </button>

          {/* Tiroir mémo Ordre du Jour (si en plein écran) */}
          {ojMemoContent && isFullscreen && (
            <button
              type="button"
              onClick={() => setShowOjMemo(!showOjMemo)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showOjMemo
                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 bg-slate-900 border border-slate-700'
              }`}
              title="Afficher l'Ordre du Jour en mémo sur le côté"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>{showOjMemo ? "Masquer l'OJ" : "Voir l'OJ"}</span>
            </button>
          )}

          {/* Bouton Plein Écran */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isFullscreen
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-300 hover:bg-slate-800 bg-slate-900 border border-slate-700'
            }`}
            title={isFullscreen ? 'Quitter le plein écran (Échap)' : 'Mode plein écran sans distraction'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? 'Réduire' : 'Plein écran'}</span>
          </button>

          {/* Bouton Ouvrir dans OnlyOffice si disponible */}
          {docxUrl && (
            <a
              href={docxUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-950/70 text-blue-300 border border-blue-800 hover:bg-blue-900/60 transition-colors shadow-sm"
              title="Ouvrir le fichier Word dans OnlyOffice sur kDrive"
            >
              <span>OnlyOffice</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* Bouton Sauvegarder & Générer Word (.docx) */}
          <button
            type="button"
            onClick={handleSaveAndExportDocx}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white shadow-lg shadow-brand-600/30 transition-all active:scale-95"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Génération Word...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Enregistrer Word (.docx)</span>
              </>
            )}
          </button>

        </div>

      </div>

      {/* 2. Zone principale : Édition ou Aperçu stylisé */}
      <div className={`relative flex-1 flex ${showOjMemo && isFullscreen ? 'gap-6' : ''} overflow-hidden min-h-[500px]`}>
        
        {/* Colonne de rédaction / aperçu */}
        <div className={`flex-1 flex flex-col ${isFullscreen && !showOjMemo ? 'max-w-5xl w-full mx-auto' : ''} overflow-hidden`}>
          {viewMode === 'edit' ? (
            <div className="relative flex-1 flex flex-col">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Tapez votre compte-rendu ici...&#10;Astuce : tapez '/' pour insérer un titre, une tâche ou une décision, ou '@' pour assigner un membre du CP !"
              className="flex-1 w-full p-5 bg-slate-900 font-mono text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
            />

            {/* Menu flottant Slash Command (/) */}
            {slashMenuOpen && filteredSlash.length > 0 && (
              <div className="absolute left-6 top-12 z-40 w-72 rounded-2xl bg-slate-850 border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in duration-100">
                <div className="p-2 border-b border-slate-800 text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                  <span>Commandes rapides (Tapez '/')</span>
                  <span>{filteredSlash.length}</span>
                </div>
                <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-800/40">
                  {filteredSlash.map((cmd, idx) => (
                    <button
                      key={cmd.id}
                      type="button"
                      onClick={() => applySlashCommand(cmd)}
                      className={`w-full text-left p-2.5 rounded-xl flex items-start gap-2.5 transition-colors ${
                        idx === slashIndex ? 'bg-brand-600 text-white' : 'hover:bg-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="p-1 rounded-lg bg-slate-900/60 shrink-0 mt-0.5">
                        {cmd.icon}
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{cmd.label}</p>
                        <p className={`text-[10px] ${idx === slashIndex ? 'text-brand-100' : 'text-slate-400'}`}>
                          {cmd.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Menu flottant Membre (@) */}
            {mentionMenuOpen && filteredMembers.length > 0 && (
              <div className="absolute left-10 top-12 z-40 w-64 rounded-2xl bg-slate-850 border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in duration-100">
                <div className="p-2 border-b border-slate-800 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Membres du Comité (CP)
                </div>
                <div className="max-h-56 overflow-y-auto p-1">
                  {filteredMembers.map((m, idx) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => applyMention(m)}
                      className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-colors ${
                        idx === mentionIndex ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                          {m.firstName?.[0] || 'M'}
                        </div>
                        <span className="text-xs font-medium">{m.displayName}</span>
                      </div>
                      <span className={`text-[10px] font-mono ${idx === mentionIndex ? 'text-indigo-200' : 'text-slate-400'}`}>
                        @{m.mentionName}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        ) : (
          /* Aperçu Document Stylisé */
          <div className="flex-1 p-8 overflow-y-auto bg-slate-950/60 max-w-4xl mx-auto w-full space-y-4 text-slate-200">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4">
              <div className="text-center pb-4 border-b border-slate-800">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Action Mondiale pour Dieu • Delémont
                </p>
                <h2 className="text-2xl font-black text-brand-400 mt-1">
                  {docxTitle || `Procès-Verbal • ${meetingDate || ''}`}
                </h2>
                {meetingDate && (
                  <p className="text-xs text-slate-400 mt-1">
                    Séance ordinaire du Conseil du {meetingDate}
                  </p>
                )}
              </div>

              <div className="space-y-3 font-sans leading-relaxed text-sm">
                {content.split(/\r?\n/).map((line, lIdx) => {
                  const t = line.trim();
                  if (!t) return <div key={lIdx} className="h-2" />;

                  if (t.startsWith('# ')) {
                    return <h1 key={lIdx} className="text-xl font-bold text-white pt-4 pb-1 border-b border-slate-800">{t.replace(/^#\s+/, '')}</h1>;
                  }
                  if (t.startsWith('## ')) {
                    return <h2 key={lIdx} className="text-lg font-bold text-sky-400 pt-3 pb-1">{t.replace(/^##\s+/, '')}</h2>;
                  }
                  if (t.startsWith('### ')) {
                    return <h3 key={lIdx} className="text-base font-semibold text-slate-200 pt-2">{t.replace(/^###\s+/, '')}</h3>;
                  }
                  if (t.startsWith('>')) {
                    const quote = t.replace(/^>\s*/, '');
                    const isDec = quote.toLowerCase().includes('décision');
                    const isPray = quote.toLowerCase().includes('prière');

                    return (
                      <div
                        key={lIdx}
                        className={`p-3.5 rounded-xl border my-2 text-xs font-medium ${
                          isDec
                            ? 'bg-blue-950/40 border-blue-500/50 text-blue-200'
                            : isPray
                            ? 'bg-purple-950/40 border-purple-500/50 text-purple-200'
                            : 'bg-slate-800/60 border-slate-700 text-slate-300'
                        }`}
                      >
                        {quote}
                      </div>
                    );
                  }
                  if (/^[-*]\s*\[([ xX])\]/.test(t)) {
                    const checked = /\[[xX]\]/.test(t);
                    const taskText = t.replace(/^[-*]\s*\[([ xX])\]\s*/, '');
                    return (
                      <div key={lIdx} className="flex items-center gap-2.5 py-1 text-xs text-slate-300">
                        <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${checked ? 'bg-emerald-600 text-white' : 'border border-slate-600'}`}>
                          {checked ? '✓' : ''}
                        </span>
                        <span className={checked ? 'line-through text-slate-500' : ''}>{taskText}</span>
                      </div>
                    );
                  }
                  if (/^[-*]\s+/.test(t)) {
                    return <li key={lIdx} className="ml-4 list-disc text-xs text-slate-300">{t.replace(/^[-*]\s+/, '')}</li>;
                  }

                  return <p key={lIdx} className="text-xs text-slate-300">{line}</p>;
                })}
              </div>
            </div>
          </div>
        )}
      </div>

        {/* Volet latéral mémo de l'Ordre du Jour (uniquement en plein écran si activé) */}
        {showOjMemo && isFullscreen && ojMemoContent && (
          <div className="w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">Ordre du Jour (Mémo)</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowOjMemo(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Masquer
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-1 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
              {ojMemoContent}
            </div>
          </div>
        )}

      </div>

      {/* 3. Pied de page informatif */}
      <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span>{content.split(/\s+/).filter(Boolean).length} mots</span>
          <span>•</span>
          <span>Raccourcis : <code className="text-slate-400 bg-slate-800 px-1 rounded">/</code> pour les commandes, <code className="text-slate-400 bg-slate-800 px-1 rounded">@</code> pour assigner un membre</span>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges ? (
            <span className="text-amber-400 font-semibold">• Non enregistré</span>
          ) : (
            <span className="text-emerald-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Synchronisé kDrive
            </span>
          )}
        </div>
      </div>

    </div>
  );
};
