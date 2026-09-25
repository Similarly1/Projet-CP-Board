import React, { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
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
  Bold,
  Italic,
  List,
  Quote,
  AtSign,
  HeartHandshake,
  Sparkles,
  Maximize2,
  Minimize2,
  BookOpen,
  ChevronDown
} from 'lucide-react';
import { CommitteeMember } from '../types';
import { api } from '../services/api';
import { useToast } from './Toast';

interface RichMeetingEditorProps {
  folderId?: string | number;
  fileName: string;
  initialContent: string;
  meetingDate?: string;
  docxTitle?: string;
  docxUrl?: string;
  ojMemoContent?: string;
  documentType?: 'pv' | 'oj';
  onCustomSave?: (content: string) => Promise<void>;
  onSaved?: () => void;
}

export const RichMeetingEditor: React.FC<RichMeetingEditorProps> = ({
  folderId,
  fileName,
  initialContent,
  meetingDate,
  docxTitle,
  docxUrl,
  ojMemoContent,
  documentType = 'pv',
  onCustomSave,
  onSaved,
}) => {
  const { success, error } = useToast();

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syncTasks, setSyncTasks] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOjMemo, setShowOjMemo] = useState(false);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);

  // Membres du CP pour l'assignation rapide
  const [members, setMembers] = useState<CommitteeMember[]>([]);

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

  // Écoute de la touche Échap pour quitter le plein écran
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Initialisation de TipTap en mode Markdown natif WYSIWYG
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder:
          documentType === 'oj'
            ? "Rédigez l'Ordre du Jour directement ici... Titres, points à aborder et participants."
            : "Rédigez le procès-verbal directement ici... Vous pouvez utiliser la barre d'outils pour ajouter des titres, des tâches et des décisions.",
      }),
      Markdown.configure({
        html: true,
        tightLists: true,
        bulletListMarker: '-',
      }),
    ],
    content: initialContent || '',
    onUpdate: () => {
      setHasUnsavedChanges(true);
    },
  });

  // Mise à jour si la séance change
  useEffect(() => {
    if (editor && initialContent !== undefined) {
      const currentMd = (editor.storage as any).markdown?.getMarkdown?.() || '';
      if (initialContent.trim() !== currentMd.trim()) {
        try {
          const parsed = (editor.storage as any).markdown?.parser?.parse(initialContent);
          editor.commands.setContent(parsed || initialContent);
        } catch {
          editor.commands.setContent(initialContent);
        }
        setHasUnsavedChanges(false);
      }
    }
  }, [initialContent, editor]);

  // Commandes de la barre d'outils
  const toggleH1 = () => editor?.chain().focus().toggleHeading({ level: 1 }).run();
  const toggleH2 = () => editor?.chain().focus().toggleHeading({ level: 2 }).run();
  const toggleH3 = () => editor?.chain().focus().toggleHeading({ level: 3 }).run();
  const toggleBold = () => editor?.chain().focus().toggleBold().run();
  const toggleItalic = () => editor?.chain().focus().toggleItalic().run();
  const toggleBulletList = () => editor?.chain().focus().toggleBulletList().run();
  const toggleTaskList = () => editor?.chain().focus().toggleTaskList().run();

  const insertDecision = () => {
    if (!editor) return;
    editor.chain().focus().insertContent('<p><strong>Décision :</strong> </p>').run();
  };

  const insertPrayer = () => {
    if (!editor) return;
    editor.chain().focus().insertContent('<h2>Accueil &amp; Prière</h2><p>Partage spirituel et remise de la séance au Seigneur.</p>').run();
  };

  const insertMember = (member: CommitteeMember) => {
    if (!editor) return;
    const tag = `@${member.displayName} (${member.mentionName}) `;
    editor.chain().focus().insertContent(tag).run();
    setShowMemberDropdown(false);
  };

  // Sauvegarder & Générer le document Word .docx sur kDrive
  const handleSaveAndExportDocx = async () => {
    if (!editor) return;
    setIsSaving(true);
    try {
      const markdownContent = (editor.storage as any).markdown?.getMarkdown?.() || editor.getText();
      
      if (onCustomSave) {
        await onCustomSave(markdownContent);
      } else if (documentType === 'oj') {
        if (!folderId) throw new Error("Dossier kDrive non spécifié pour enregistrer l'OJ");
        await api.saveMeetingOj(folderId, {
          content: markdownContent,
          meetingDate,
        });
        success('Ordre du jour enregistré et exporté en Word (.docx) sur kDrive !');
      } else {
        if (!folderId) throw new Error("Dossier kDrive non spécifié pour enregistrer le PV");
        const res = await api.saveAndExportDocx({
          folderId,
          fileName,
          content: markdownContent,
          docxTitle: docxTitle || `Procès-Verbal de Séance • ${meetingDate || ''}`,
          meetingDate,
          syncTasks,
        });

        success(
          res.syncedTaskCount > 0
            ? `Enregistré ! Document Word généré sur kDrive & ${res.syncedTaskCount} tâche(s) synchronisée(s).`
            : `Enregistré ! Document Word (.docx) généré et synchronisé sur kDrive.`
        );
      }

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
          ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col p-4 sm:p-6 overflow-hidden animate-fadeIn'
          : 'flex flex-col h-full bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl'
      }
    >
      {/* 1. Barre d'outils supérieure (WYSIWYG) */}
      <div className="p-3 bg-slate-950/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        {/* Formatage direct */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={toggleH1}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              editor?.isActive('heading', { level: 1 })
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Titre de section principal (H1)"
          >
            H1
          </button>
          <button
            type="button"
            onClick={toggleH2}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              editor?.isActive('heading', { level: 2 })
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Point d'Ordre du Jour (H2)"
          >
            H2
          </button>
          <button
            type="button"
            onClick={toggleH3}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              editor?.isActive('heading', { level: 3 })
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Sous-point (H3)"
          >
            H3
          </button>

          <span className="w-px h-4 bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={toggleBold}
            className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${
              editor?.isActive('bold')
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Gras (Ctrl+B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleItalic}
            className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${
              editor?.isActive('italic')
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Italique (Ctrl+I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleBulletList}
            className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${
              editor?.isActive('bulletList')
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Liste à puces"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleTaskList}
            className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${
              editor?.isActive('taskList')
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Insérer ou convertir en case à cocher (Tâche)"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>

          <span className="w-px h-4 bg-slate-800 mx-1" />

          {/* Boutons d'insertion rapide type PV */}
          <button
            type="button"
            onClick={insertDecision}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20 transition-colors"
            title="Insérer une mention de Décision"
          >
            <Sparkles className="w-3 h-3 text-sky-400" />
            <span>Décision</span>
          </button>

          <button
            type="button"
            onClick={insertPrayer}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 transition-colors"
            title="Insérer la section Accueil & Prière"
          >
            <HeartHandshake className="w-3 h-3 text-purple-400" />
            <span>Prière</span>
          </button>

          {/* Menu déroulant Membres du CP (@) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMemberDropdown(!showMemberDropdown)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              title="Assigner ou mentionner un membre du CP"
            >
              <AtSign className="w-3 h-3 text-indigo-400" />
              <span>Membre CP</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showMemberDropdown && members.length > 0 && (
              <div className="absolute left-0 top-full mt-1.5 z-50 w-56 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden animate-fadeIn py-1">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  Membres du Comité
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => insertMember(m)}
                      className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:text-white hover:bg-indigo-600/40 flex items-center justify-between transition-colors"
                    >
                      <span className="font-medium">{m.displayName}</span>
                      <span className="text-[10px] font-mono text-indigo-300">@{m.mentionName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions & Sauvegarde */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Synchronisation automatique des tâches vers Taches_Comite.md (uniquement en PV) */}
          {documentType === 'pv' && (
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
              <input
                type="checkbox"
                checked={syncTasks}
                onChange={(e) => setSyncTasks(e.target.checked)}
                className="rounded border-slate-700 text-indigo-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer accent-indigo-600"
              />
              <span className="text-[11px]">Sync tâches kDrive</span>
            </label>
          )}

          {/* Tiroir mémo Ordre du Jour (consultable en cours de rédaction de PV) */}
          {documentType === 'pv' && ojMemoContent && (
            <button
              type="button"
              onClick={() => setShowOjMemo(!showOjMemo)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                showOjMemo
                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-900 border border-slate-700'
              }`}
              title="Consulter l'Ordre du Jour en mémo sur le côté"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>{showOjMemo ? "Masquer l'OJ" : "Consulter l'OJ"}</span>
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
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
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

      {/* 2. Zone principale : Document WYSIWYG en page officielle */}
      <div className={`relative flex-1 flex ${showOjMemo ? 'gap-4 sm:gap-6' : ''} overflow-hidden min-h-[550px]`}>
        
        {/* Feuille de rédaction riche */}
        <div className={`flex-1 flex flex-col ${isFullscreen && !showOjMemo ? 'max-w-4xl w-full mx-auto' : ''} overflow-y-auto p-4 sm:p-8 bg-slate-950/50`}>
          <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-6 sm:p-10 shadow-2xl max-w-4xl mx-auto w-full">
            
            {/* En-tête officiel de séance */}
            <div className="text-center pb-6 border-b border-slate-800 mb-6">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Action Mondiale pour Dieu • Delémont
              </p>
              <h2 className="text-2xl sm:text-3xl font-black text-indigo-400 mt-1.5">
                {docxTitle || `Procès-Verbal • ${meetingDate || ''}`}
              </h2>
              {meetingDate && (
                <p className="text-xs text-slate-400 mt-1">
                  Séance ordinaire du Conseil du {meetingDate}
                </p>
              )}
            </div>

            {/* Éditeur TipTap direct (aucun code brut, véritable document mis en page) */}
            <div className="cursor-text" onClick={() => editor?.commands.focus()}>
              <EditorContent editor={editor} />
            </div>

          </div>
        </div>

        {/* Volet latéral mémo de l'Ordre du Jour (escamotable à la demande) */}
        {showOjMemo && ojMemoContent && (
          <div className="w-80 sm:w-96 bg-slate-900/95 border-l border-slate-800 sm:border sm:rounded-xl p-4 sm:p-5 flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-right duration-200 shrink-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">Ordre du Jour</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowOjMemo(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                title="Masquer le mémo"
              >
                ✕ Masquer
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-1 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans select-text">
              {ojMemoContent}
            </div>
          </div>
        )}
      </div>

      {/* 3. Pied de page informatif */}
      <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span>{editor?.getText().split(/\s+/).filter(Boolean).length || 0} mots</span>
          <span>•</span>
          <span className="text-slate-400">Éditeur enrichi WYSIWYG actif</span>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges ? (
            <span className="text-amber-400 font-semibold">• Non enregistré</span>
          ) : (
            <span className="text-emerald-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Synchronisé kDrive (.docx)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
