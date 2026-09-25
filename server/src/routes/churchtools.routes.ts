import { Router } from 'express';
import { churchToolsService } from '../services/churchtools.service';

const router = Router();

/**
 * GET /api/churchtools/members
 * Récupère les membres officiels du groupe comité (CP)
 */
router.get('/members', async (req, res) => {
  try {
    const members = await churchToolsService.getCommitteeMembers();
    res.json({ members });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/churchtools/persons?q=
 * Recherche de personnes pour l'autocomplétion
 */
router.get('/persons', async (req, res) => {
  try {
    const query = String(req.query.q || '');
    const persons = await churchToolsService.searchPersons(query);
    res.json({ persons });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/churchtools/followups
 * Création d'un suivi pastoral/relationnel
 */
router.post('/followups', async (req, res) => {
  try {
    const { targetPersonId, assigneePersonId, comment, dueDate } = req.body;

    if (!targetPersonId) {
      return res.status(400).json({ error: 'La personne cible (targetPersonId) est requise.' });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Le commentaire / consigne est requis.' });
    }

    const result = await churchToolsService.createFollowUp({
      targetPersonId: Number(targetPersonId),
      assigneePersonId: assigneePersonId ? Number(assigneePersonId) : undefined,
      comment: comment.trim(),
      dueDate: dueDate || undefined,
    });

    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
