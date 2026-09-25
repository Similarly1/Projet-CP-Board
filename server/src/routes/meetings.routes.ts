import { Router } from 'express';
import { churchToolsService } from '../services/churchtools.service';
import { kDriveService } from '../services/kdrive.service';
import { meetingDbService } from '../db/database';

const router = Router();

/**
 * GET /api/meetings/upcoming
 * Récupère les réunions à venir depuis ChurchTools (avec cache 30 min)
 * et enrichit avec le statut kDrive (dossier, ODJ, PV)
 */
router.get('/upcoming', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const meetings = await churchToolsService.getUpcomingMeetings(forceRefresh);

    // Enrichit chaque réunion avec le statut de dossier kDrive (depuis SQLite ou kDrive)
    const enrichedMeetings = await Promise.all(
      meetings.map(async (meeting) => {
        const dateMatch = meeting.startDate.match(/^(\d{4}-\d{2}-\d{2})/);
        const dateStr = dateMatch ? dateMatch[1] : '';

        let kDriveData = dateStr ? meetingDbService.getByDate(dateStr) : null;

        // Si pas dans le cache local SQLite, vérifier directement dans kDrive si configuré
        if (!kDriveData && dateStr && kDriveService.driveId) {
          try {
            const folderName = `${dateStr} - Séance du Conseil`;
            const folder = await kDriveService.findItemByName(kDriveService.rootFolderId, folderName);
            if (folder && folder.type === 'dir') {
              // Récupérer les fichiers du dossier pour voir si ODJ / PV existent
              const files = await kDriveService.listFiles(folder.id);
              const odj = files.find((f) => f.name.includes('_Ordre_du_Jour.md') || f.name.includes('_ODJ.md'));
              const pv = files.find((f) => f.name.includes('_PV.md'));

              kDriveData = {
                meeting_date: dateStr,
                folder_id: String(folder.id),
                folder_name: folder.name,
                odj_file_id: odj ? String(odj.id) : undefined,
                pv_file_id: pv ? String(pv.id) : undefined,
                created_at: Date.now(),
              };

              meetingDbService.save(kDriveData);
            }
          } catch (e) {
            // Ignorer si kDrive est indisponible
          }
        }

        return {
          ...meeting,
          dateStr,
          kDrive: kDriveData
            ? {
                folderId: kDriveData.folder_id,
                folderName: kDriveData.folder_name,
                hasFolder: true,
                odjFileId: kDriveData.odj_file_id,
                pvFileId: kDriveData.pv_file_id,
              }
            : {
                hasFolder: false,
              },
        };
      })
    );

    res.json({ meetings: enrichedMeetings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/meetings/init
 * Crée le dossier kDrive pour une séance et génère l'Ordre du Jour
 */
router.post('/init', async (req, res) => {
  try {
    const { meetingDate, title, selectedNoteIds, customNotes } = req.body;

    if (!meetingDate) {
      return res.status(400).json({ error: 'La date de la séance (YYYY-MM-DD) est requise.' });
    }

    const folderName = `${meetingDate} - Séance du Conseil`;

    // 1. Créer le dossier principal de la séance
    const folder = await kDriveService.createDirectory(kDriveService.rootFolderId, folderName);

    // 2. Créer le sous-dossier Annexes/
    await kDriveService.createDirectory(folder.id, 'Annexes');

    // 3. Récupérer les notes ChurchTools sélectionnées si des IDs ont été transmis
    let notesText = '';
    if (Array.isArray(selectedNoteIds) && selectedNoteIds.length > 0) {
      try {
        const allNotes = await churchToolsService.getPendingNotes();
        const selected = allNotes.filter((n) => selectedNoteIds.includes(n.id));
        if (selected.length > 0) {
          notesText = selected
            .map((n) => `### Sujet : Note de ${n.authorName}\n${n.text}\n`)
            .join('\n');
        }
      } catch (e) {
        console.warn('Impossible de récupérer les notes pour l injection:', e);
      }
    }

    if (customNotes) {
      notesText += `\n${customNotes}\n`;
    }

    if (!notesText.trim()) {
      notesText = `*Aucun point spécifique soumis préalablement.*`;
    }

    // 4. Générer le contenu du modèle d'Ordre du Jour
    const odjFileName = `${meetingDate}_Ordre_du_Jour.md`;
    const odjContent = `# Ordre du Jour - ${folderName}

**Date :** ${meetingDate}
**Titre :** ${title || 'Séance ordinaire du Conseil'}
**Lieu :** Salle du Conseil / Visio
**Présents :**
**Excusés :**

---

## 1. Méditation & Prière
- Temps de partage et remise de la séance à Dieu.

## 2. Approbation du procès-verbal précédent
- Relecture des décisions et validation du PV précédent.

## 3. Points à l'ordre du jour & Notes de préparation
${notesText}

## 4. Intendance, Finances & Organisation matérielle
- Suivi des devis, locaux et décisions logistiques.

## 5. Suivi Pastoral & Relationnel (Follow-ups)
- Accompagnement des membres et nouvelles familles.

## 6. Divers & Prochaine Séance
- Prochaine rencontre fixée au : 
`;

    // 5. Sauvegarder le fichier ODJ sur kDrive
    const odjFile = await kDriveService.saveTextFile(folder.id, odjFileName, odjContent);

    // 6. Enregistrer dans la base locale SQLite
    meetingDbService.save({
      meeting_date: meetingDate,
      folder_id: String(folder.id),
      folder_name: folderName,
      odj_file_id: String(odjFile.id),
    });

    res.json({
      success: true,
      folderId: folder.id,
      folderName: folder.name,
      odjFileId: odjFile.id,
      odjFileName,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/meetings/pv/start
 * Clone l'ODJ vers un nouveau fichier YYYY-MM-DD_PV.md
 */
router.post('/pv/start', async (req, res) => {
  try {
    const { meetingDate, folderId } = req.body;

    if (!meetingDate || !folderId) {
      return res.status(400).json({ error: 'meetingDate et folderId sont requis.' });
    }

    const pvFileName = `${meetingDate}_PV.md`;
    const files = await kDriveService.listFiles(folderId);

    // Vérifier si le PV existe déjà
    const existingPv = files.find((f) => f.name === pvFileName);
    if (existingPv) {
      meetingDbService.updatePvFileId(meetingDate, String(existingPv.id));
      const content = await kDriveService.getFileTextContent(existingPv.id);
      return res.json({
        pvFileId: existingPv.id,
        pvFileName,
        content,
        alreadyExisted: true,
      });
    }

    // Récupérer le contenu de l'ODJ existant comme base
    const odjFile = files.find((f) => f.name.includes('_Ordre_du_Jour.md') || f.name.includes('_ODJ.md'));
    let baseContent = '';

    if (odjFile) {
      baseContent = await kDriveService.getFileTextContent(odjFile.id);
      // Remplacer "Ordre du Jour" par "Procès-Verbal" dans le titre
      baseContent = baseContent.replace(/# Ordre du Jour/i, '# Procès-Verbal');
    } else {
      baseContent = `# Procès-Verbal - Séance du ${meetingDate}\n\n**Date :** ${meetingDate}\n**Rédacteur :**\n\n## Décisions\n`;
    }

    // Sauvegarder le nouveau fichier PV sur kDrive
    const createdPv = await kDriveService.saveTextFile(folderId, pvFileName, baseContent);
    meetingDbService.updatePvFileId(meetingDate, String(createdPv.id));

    res.json({
      pvFileId: createdPv.id,
      pvFileName,
      content: baseContent,
      alreadyExisted: false,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/meetings/all
 * Récupère l'ensemble des séances enregistrées dans la base de données
 */
router.get('/all', async (req, res) => {
  try {
    const meetings = meetingDbService.getAll();
    res.json({ meetings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
