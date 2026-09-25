import { Router } from 'express';
import multer from 'multer';
import { kDriveService } from '../services/kdrive.service';
import { docxService } from '../services/docx.service';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

/**
 * GET /api/files/:fileId/content
 * Récupère le texte brut d'un fichier Markdown
 */
router.get('/:fileId/content', async (req, res) => {
  try {
    const { fileId } = req.params;
    const content = await kDriveService.getFileTextContent(fileId);
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/files/:fileId/content
 * Sauvegarde le texte d'un fichier Markdown
 */
router.put('/:fileId/content', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { content, parentFolderId, fileName } = req.body;

    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Le champ content (texte) est requis.' });
    }

    const folderId = parentFolderId || kDriveService.rootFolderId;
    const name = fileName || `document_${fileId}.md`;

    const updated = await kDriveService.updateFileContent(folderId, fileId, name, content);
    res.json({ success: true, file: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/files/save-and-export-docx
 * Sauvegarde la version texte dans kDrive ET compile un document Word (.docx) officiel sur kDrive
 */
router.post('/save-and-export-docx', async (req, res) => {
  try {
    const { folderId, fileName, content, docxTitle, meetingDate, syncTasks } = req.body;

    if (!folderId || typeof content !== 'string') {
      return res.status(400).json({ error: 'folderId et content requis.' });
    }

    const baseName = (fileName || `PV_${meetingDate || 'Seance'}`).replace(/\.(docx?|md)$/i, '');

    // 1. Sauvegarde du fichier Markdown source dans kDrive
    const mdName = `${baseName}.md`;
    await kDriveService.saveTextFile(folderId, mdName, content);

    // 2. Compilation et upload du document Word (.docx) sur kDrive
    const title = docxTitle || `Procès-Verbal - Séance du ${meetingDate || ''}`;
    const docxBuffer = await docxService.markdownToDocxBuffer(title, content, { dateStr: meetingDate });
    const docxName = `${baseName}.docx`;

    const docxFile = await kDriveService.uploadFile(
      folderId,
      docxName,
      docxBuffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    // 3. Extraction et synchronisation automatique des tâches - [ ] vers Taches_Comite.md
    let syncedTaskCount = 0;
    if (syncTasks) {
      const { tasksService } = await import('../services/tasks.service');
      const lines = content.split(/\r?\n/);
      for (const l of lines) {
        const match = l.match(/^\s*[-*]\s*\[\s*\]\s*(.*)$/);
        if (match) {
          const rest = match[1].trim();
          const parts = rest.split('|').map((p) => p.trim());
          if (parts[0]) {
            let assignee: string | null = null;
            let dueDate: string | null = null;
            let refMeeting: string | null = meetingDate || null;

            for (let i = 1; i < parts.length; i++) {
              if (parts[i].startsWith('@')) assignee = parts[i].substring(1);
              else if (/^\d{4}-\d{2}-\d{2}$/.test(parts[i])) dueDate = parts[i];
              else if (/^réf/i.test(parts[i])) refMeeting = parts[i].replace(/^réf:?\s*/i, '');
            }

            try {
              await tasksService.addTask({
                title: parts[0],
                assignee,
                dueDate,
                refMeeting,
              });
              syncedTaskCount++;
            } catch (e) {
              console.warn('Impossible de synchroniser la tâche:', parts[0]);
            }
          }
        }
      }
    }

    res.json({
      success: true,
      docxFile,
      syncedTaskCount,
      message: `Document Word "${docxName}" généré sur kDrive !`,
    });
  } catch (err: any) {
    console.error('Erreur export docx:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/files/upload
 * Téléverse un fichier annexe vers un dossier de séance
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { folderId } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'Aucun fichier transmis.' });
    }

    if (!folderId) {
      return res.status(400).json({ error: 'Identifiant du dossier cible (folderId) requis.' });
    }

    const uploaded = await kDriveService.uploadFile(
      folderId,
      file.originalname,
      file.buffer,
      file.mimetype || 'application/octet-stream'
    );

    res.json({ success: true, file: uploaded });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/files/folder/:folderId
 * Liste les fichiers contenus dans un dossier (pour afficher les annexes et documents d'une séance)
 */
router.get('/folder/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const files = await kDriveService.listFiles(folderId);
    res.json({ files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
