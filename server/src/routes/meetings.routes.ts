import { Router } from 'express';
import { meetingsService } from '../services/meetings.service';
import { kDriveService } from '../services/kdrive.service';
import { docxService } from '../services/docx.service';
import { tasksService } from '../services/tasks.service';

const router = Router();

/**
 * GET /api/meetings
 * Liste toutes les séances (dossiers kDrive CP MM.DD + rendez-vous ChurchTools)
 */
router.get('/', async (req, res) => {
  try {
    const year = parseInt((req.query.year as string) || '2026', 10);
    const meetings = await meetingsService.listMeetings(year);
    res.json({ meetings });
  } catch (err: any) {
    console.error('Erreur liste réunions:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/meetings/upcoming
 * Récupère les séances à venir (prioritaire sur /:folderId)
 * Compatible avec l'écran Dashboard (meetings: Meeting[]) et l'API (meeting: MeetingSummary)
 */
router.get('/upcoming', async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const meetingsList = await meetingsService.listMeetings(year);

    const mappedMeetings = meetingsList.map((m) => ({
      id: m.folderId || m.dateStr,
      title: m.displayTitle,
      startDate: m.churchToolsAppointment?.startDate || `${m.dateStr}T19:30:00`,
      endDate: m.churchToolsAppointment?.endDate,
      location: m.churchToolsAppointment?.location || 'AMD Delémont',
      description: m.churchToolsAppointment?.description,
      calendarName: 'CP & EMP • CE & EMS',
      dateStr: m.dateStr,
      kDrive: {
        folderId: m.folderId,
        folderName: m.folderName,
        folderUrl: m.folderId ? `https://ksuite.infomaniak.com/129335/kdrive/app/drive/1198945/files/${m.folderId}` : undefined,
        hasFolder: !!m.folderId,
        odjIsDocx: m.hasOj,
        pvIsDocx: m.hasPv,
      },
    }));

    const upcomingMeetings = mappedMeetings.filter((m) => {
      const summary = meetingsList.find((x) => x.dateStr === m.dateStr);
      return summary?.isUpcoming;
    });

    // Trier les séances à venir dans l'ordre chronologique (la plus proche en premier)
    upcomingMeetings.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    res.json({
      meetings: upcomingMeetings.length > 0 ? upcomingMeetings : mappedMeetings.slice(0, 5),
      meeting: upcomingMeetings[0] || mappedMeetings[0] || null,
    });
  } catch (err: any) {
    console.error('Erreur /api/meetings/upcoming:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/meetings/:folderId
 * Récupère le détail complet d'une séance (OJ, PV, Fichiers, Rôles)
 */
router.get('/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const details = await meetingsService.getMeetingDetails(folderId);
    res.json({ details });
  } catch (err: any) {
    console.error(`Erreur détail séance (${req.params.folderId}):`, err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/meetings/create-folder
 * Crée un nouveau dossier de séance au format CP MM.DD sur kDrive
 */
router.post('/create-folder', async (req, res) => {
  try {
    const { dateStr, topic } = req.body;
    if (!dateStr) {
      return res.status(400).json({ error: 'La date (dateStr: YYYY-MM-DD) est requise.' });
    }

    const folder = await kDriveService.createMeetingFolder(dateStr, topic);
    res.json({ success: true, folder });
  } catch (err: any) {
    console.error('Erreur création dossier séance:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/meetings/:folderId/save-oj
 * Sauvegarde l'Ordre du Jour (.docx et .md) sur kDrive
 */
router.post('/:folderId/save-oj', async (req, res) => {
  try {
    const { folderId } = req.params;
    const { content, meetingDate } = req.body;

    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Contenu (content) requis.' });
    }

    // 1. Sauvegarde OJ.md
    await kDriveService.saveTextFile(folderId, 'OJ.md', content);

    // 2. Compilation et upload OJ.docx
    const docxTitle = `Ordre du Jour - Séance du ${meetingDate || ''}`;
    const docxBuffer = await docxService.markdownToDocxBuffer(docxTitle, content, { dateStr: meetingDate });
    const docxFile = await kDriveService.uploadFile(
      folderId,
      'OJ.docx',
      docxBuffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    res.json({ success: true, docxFile, message: 'Ordre du jour sauvegardé et exporté en Word sur kDrive !' });
  } catch (err: any) {
    console.error('Erreur sauvegarde OJ:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/meetings/:folderId/save-pv
 * Sauvegarde le Procès-Verbal (.docx et .md) sur kDrive et synchronise les tâches
 */
router.post('/:folderId/save-pv', async (req, res) => {
  try {
    const { folderId } = req.params;
    const { content, meetingDate, docxTitle, syncTasks = true } = req.body;

    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Contenu (content) requis.' });
    }

    const parts = (meetingDate || '').split('-');
    const dateFormatted = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : meetingDate || '';
    const baseName = `PV - CP ${dateFormatted || 'Seance'}`;

    // 1. Sauvegarde Markdown source
    await kDriveService.saveTextFile(folderId, `${baseName}.md`, content);

    // 2. Compilation et upload Word (.docx)
    const title = docxTitle || `Procès-Verbal - Séance du ${meetingDate || ''}`;
    const docxBuffer = await docxService.markdownToDocxBuffer(title, content, { dateStr: meetingDate });
    const docxName = `${baseName}.docx`;
    const docxFile = await kDriveService.uploadFile(
      folderId,
      docxName,
      docxBuffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    // 3. Synchronisation automatique des tâches - [ ] vers Taches_Comite.md
    let syncedTaskCount = 0;
    if (syncTasks) {
      const lines = content.split(/\r?\n/);
      for (const l of lines) {
        const match = l.match(/^\s*[-*]\s*\[\s*\]\s*(.*)$/);
        if (match) {
          const rest = match[1].trim();
          const taskParts = rest.split('|').map((p) => p.trim());
          if (taskParts[0]) {
            let assignee: string | null = null;
            let dueDate: string | null = null;
            let refMeeting: string | null = meetingDate || null;

            for (let i = 1; i < taskParts.length; i++) {
              if (taskParts[i].startsWith('@')) assignee = taskParts[i].substring(1);
              else if (/^\d{4}-\d{2}-\d{2}$/.test(taskParts[i])) dueDate = taskParts[i];
              else if (/^réf/i.test(taskParts[i])) refMeeting = taskParts[i].replace(/^réf:?\s*/i, '');
            }

            try {
              await tasksService.addTask({
                title: taskParts[0],
                assignee,
                dueDate,
                refMeeting,
              });
              syncedTaskCount++;
            } catch (e) {
              console.warn('Impossible de synchroniser la tâche:', taskParts[0]);
            }
          }
        }
      }
    }

    res.json({
      success: true,
      docxFile,
      syncedTaskCount,
      message: `Procès-Verbal sauvegardé et "${docxName}" généré sur kDrive !`,
    });
  } catch (err: any) {
    console.error('Erreur sauvegarde PV:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
