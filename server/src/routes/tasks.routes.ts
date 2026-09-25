import { Router } from 'express';
import { tasksService } from '../services/tasks.service';

const router = Router();

/**
 * GET /api/tasks
 * Télécharge, parse et renvoie la liste JSON des tâches depuis Taches_Comite.md
 */
router.get('/', async (req, res) => {
  try {
    const tasks = await tasksService.getTasks();
    res.json({ tasks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tasks
 * Ajoute une nouvelle tâche au fichier Taches_Comite.md
 */
router.post('/', async (req, res) => {
  try {
    const { title, assignee, dueDate, refMeeting } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "L'intitulé de la tâche est requis." });
    }

    const task = await tasksService.addTask({
      title: title.trim(),
      assignee: assignee ? assignee.trim() : null,
      dueDate: dueDate || null,
      refMeeting: refMeeting ? refMeeting.trim() : null,
    });

    res.json({ success: true, task });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/tasks/:index
 * Met à jour l'état (coché/décoché) d'une tâche
 */
router.patch('/:index', async (req, res) => {
  try {
    const lineIndex = parseInt(req.params.index, 10);
    const { completed } = req.body;

    if (isNaN(lineIndex)) {
      return res.status(400).json({ error: 'Index de tâche invalide.' });
    }

    const updatedTask = await tasksService.toggleTask(lineIndex, completed);
    res.json({ success: true, task: updatedTask });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
