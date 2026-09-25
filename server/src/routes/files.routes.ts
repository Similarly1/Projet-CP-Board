import { Router } from 'express';
import multer from 'multer';
import { kDriveService } from '../services/kdrive.service';

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
