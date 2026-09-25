import { Router } from 'express';
import { churchToolsService } from '../services/churchtools.service';

const router = Router();

/**
 * GET /api/notes/pending
 * Récupère les notes non archivées du groupe comité
 */
router.get('/pending', async (req, res) => {
  try {
    const notes = await churchToolsService.getPendingNotes();
    res.json({ notes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/notes
 * Ajoute une nouvelle note rapide au groupe comité
 */
router.post('/', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Le texte de la note est requis.' });
    }

    const note = await churchToolsService.createNote(text.trim());
    res.json({ success: true, note });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
