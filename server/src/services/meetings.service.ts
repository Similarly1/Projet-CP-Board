import { kDriveService, KDriveItem } from './kdrive.service';
import { churchToolsService, ChurchToolsMeeting } from './churchtools.service';
import { cacheService } from '../db/database';

export interface MeetingSummary {
  folderId?: number | string;
  folderName: string; // e.g. "CP 09.24"
  dateStr: string; // "YYYY-MM-DD"
  year: number;
  displayTitle: string;
  hasOj: boolean;
  ojFileId?: number | string;
  ojFileName?: string;
  hasPv: boolean;
  pvFileId?: number | string;
  pvFileName?: string;
  president?: string;
  secretary?: string;
  attachmentsCount: number;
  churchToolsAppointment?: ChurchToolsMeeting;
  isUpcoming: boolean;
  kdriveUrl?: string;
}

export interface MeetingDetails extends MeetingSummary {
  ojContent: string;
  pvContent: string;
  files: KDriveItem[];
  preparationNotes: { id: number; text: string; author?: string; date?: string }[];
}

export class MeetingsService {
  /**
   * Analyse le texte d'un document pour extraire le Président et le Secrétaire (PV)
   */
  private extractRoles(text: string): { president?: string; secretary?: string } {
    let president: string | undefined;
    let secretary: string | undefined;

    const presMatch = text.match(/Président\s*:\s*([^\n\r;|]+)/i);
    if (presMatch) {
      const p = presMatch[1].trim();
      if (/^[\w\s\u00C0-\u017F().-]+$/.test(p)) president = p;
    }

    const secMatch = text.match(/(?:Secrétaire|PV)\s*:\s*([^\n\r;|]+)/i);
    if (secMatch) {
      const s = secMatch[1].trim();
      if (/^[\w\s\u00C0-\u017F().-]+$/.test(s)) secretary = s;
    }

    return { president, secretary };
  }

  /**
   * Liste toutes les séances (kDrive dossiers CP MM.DD croisés avec ChurchTools)
   */
  async listMeetings(year = 2026, forceRefresh = false): Promise<MeetingSummary[]> {
    const cacheKey = `meetings_list_${year}`;
    if (!forceRefresh) {
      const cached = cacheService.get<MeetingSummary[]>(cacheKey);
      if (cached) return cached;
    }

    const yearFolderId = kDriveService.rootFolderId; // Actuellement CP - 2026 (4428)
    const files = await kDriveService.listFiles(yearFolderId);

    // Filtrer les sous-dossiers de type CP MM.DD
    const folderItems = files.filter((f) => f.type === 'dir' && /^CP\s+\d{2}\.\d{2}/i.test(f.name));

    // Récupérer les rdv calendrier ChurchTools
    let appointments: ChurchToolsMeeting[] = [];
    try {
      appointments = await churchToolsService.getUpcomingMeetings(forceRefresh);
    } catch (e: any) {
      console.warn('Impossible de charger les rendez-vous ChurchTools:', e.message);
    }

    // Récupérer en parallèle les métadonnées de fichiers de chaque dossier
    const folderDetailsMap = new Map<string | number, { files: KDriveItem[]; hasOj: boolean; hasPv: boolean; attachmentsCount: number }>();
    try {
      const detailsList = await Promise.all(
        folderItems.map(async (folder) => {
          try {
            const folderFiles = await kDriveService.listFiles(folder.id);
            const hasOj = folderFiles.some((f) => /^oj\b/i.test(f.name) || /ordre_du_jour/i.test(f.name));
            const hasPv = folderFiles.some((f) => /^pv\b/i.test(f.name) || /proces_verbal/i.test(f.name));
            return { id: folder.id, files: folderFiles, hasOj, hasPv, attachmentsCount: folderFiles.length };
          } catch {
            return { id: folder.id, files: [], hasOj: false, hasPv: false, attachmentsCount: 0 };
          }
        })
      );
      for (const d of detailsList) {
        folderDetailsMap.set(d.id, d);
      }
    } catch (e: any) {
      console.warn('Impossible de scanner les fichiers des dossiers:', e.message);
    }

    const meetings: MeetingSummary[] = [];

    // Pour chaque dossier kDrive existant
    for (const folder of folderItems) {
      const match = folder.name.match(/^CP\s+(\d{2})\.(\d{2})(?:\s*-\s*(.+))?/i);
      if (!match) continue;

      const month = match[1];
      const day = match[2];
      const extraTopic = match[3]?.trim();
      const dateStr = `${year}-${month}-${day}`;

      // Trouver le rdv ChurchTools correspondant si existant
      const matchingAppt = appointments.find((a) => a.startDate?.startsWith(dateStr));
      const fileInfo = folderDetailsMap.get(folder.id);

      meetings.push({
        folderId: folder.id,
        folderName: folder.name,
        dateStr,
        year,
        displayTitle: extraTopic ? `CP du ${day}.${month} - ${extraTopic}` : `Séance CP du ${day}.${month}.${year}`,
        hasOj: fileInfo?.hasOj || false,
        hasPv: fileInfo?.hasPv || false,
        attachmentsCount: fileInfo?.attachmentsCount || 0,
        churchToolsAppointment: matchingAppt,
        isUpcoming: new Date(dateStr).getTime() >= new Date().setHours(0, 0, 0, 0),
        kdriveUrl: folder.kdriveUrl,
      });
    }

    // Ajouter également les séances ChurchTools de la même année qui n'ont pas encore de dossier kDrive
    for (const appt of appointments) {
      const apptDate = appt.startDate?.split('T')[0];
      if (!apptDate) continue;

      const parts = apptDate.split('-');
      const apptYear = parseInt(parts[0], 10);
      // FILTRAGE STRICT PAR ANNÉE : seulement l'année en cours (2026) !
      if (apptYear !== year) continue;

      // Filtrage strict : uniquement les rencontres du CP
      if (!churchToolsService.isCpMeeting(appt.title)) {
        continue;
      }

      const alreadyExists = meetings.some((m) => m.dateStr === apptDate);
      if (!alreadyExists) {
        const month = parts[1];
        const day = parts[2];
        meetings.push({
          folderName: `CP ${month}.${day}`,
          dateStr: apptDate,
          year: apptYear,
          displayTitle: `${appt.title} (${day}.${month}.${apptYear})`,
          hasOj: false,
          hasPv: false,
          attachmentsCount: 0,
          churchToolsAppointment: appt,
          isUpcoming: true,
        });
      }
    }

    // Trier de la plus récente à la plus ancienne
    meetings.sort((a, b) => new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime());

    // Mettre en cache 2 minutes
    cacheService.set(cacheKey, meetings, 120);

    return meetings;
  }

  /**
   * Récupère le détail complet d'une séance (OJ, PV, Fichiers, Rôles)
   */
  async getMeetingDetails(folderIdOrDate: string | number): Promise<MeetingDetails> {
    let folderId: number | string | undefined;
    let dateStr = '';
    let folderName = '';

    const yearFolderId = kDriveService.rootFolderId;

    if (typeof folderIdOrDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(folderIdOrDate)) {
      dateStr = folderIdOrDate;
      const found = await kDriveService.findMeetingFolder(dateStr, yearFolderId);
      if (found) {
        folderId = found.id;
        folderName = found.name;
      }
    } else {
      folderId = folderIdOrDate;
      const yearFolders = await kDriveService.listFiles(yearFolderId);
      const folderItem = yearFolders.find((f) => String(f.id) === String(folderId));
      if (folderItem) {
        folderName = folderItem.name;
      }
    }

    if (!folderId) {
      throw new Error(`Dossier kDrive introuvable pour ${folderIdOrDate}`);
    }

    // Lister les fichiers du dossier de séance
    const folderFiles = await kDriveService.listFiles(folderId);

    let ojContent = '';
    let pvContent = '';
    let ojFileId: number | string | undefined;
    let ojFileName: string | undefined;
    let pvFileId: number | string | undefined;
    let pvFileName: string | undefined;
    let president: string | undefined;
    let secretary: string | undefined;

    // Détecter le fichier OJ (priorité .md puis .docx)
    const ojCandidates = folderFiles.filter((f) => /^oj\b/i.test(f.name) || /ordre_du_jour/i.test(f.name));
    const ojFile =
      ojCandidates.find((f) => f.name.endsWith('.md')) ||
      ojCandidates.find((f) => f.name.endsWith('.docx') || f.name.endsWith('.doc')) ||
      ojCandidates[0];

    if (ojFile) {
      ojFileId = ojFile.id;
      ojFileName = ojFile.name;
      try {
        if (ojFile.name.endsWith('.docx') || ojFile.name.endsWith('.doc')) {
          ojContent = await kDriveService.getDocxTextContent(ojFile.id);
        } else if (ojFile.name.endsWith('.md') || ojFile.name.endsWith('.txt')) {
          ojContent = await kDriveService.getFileTextContent(ojFile.id);
        }
        const roles = this.extractRoles(ojContent);
        if (roles.president) president = roles.president;
        if (roles.secretary) secretary = roles.secretary;
      } catch (err: any) {
        console.warn('Erreur lecture OJ:', err.message);
      }
    }

    // Détecter le fichier PV (priorité .md puis .docx)
    const pvCandidates = folderFiles.filter((f) => /^pv\b/i.test(f.name) || /proces_verbal/i.test(f.name));
    const pvFile =
      pvCandidates.find((f) => f.name.endsWith('.md')) ||
      pvCandidates.find((f) => f.name.endsWith('.docx') || f.name.endsWith('.doc')) ||
      pvCandidates[0];

    if (pvFile) {
      pvFileId = pvFile.id;
      pvFileName = pvFile.name;
      try {
        if (pvFile.name.endsWith('.docx') || pvFile.name.endsWith('.doc')) {
          pvContent = await kDriveService.getDocxTextContent(pvFile.id);
        } else if (pvFile.name.endsWith('.md') || pvFile.name.endsWith('.txt')) {
          pvContent = await kDriveService.getFileTextContent(pvFile.id);
        }
        const roles = this.extractRoles(pvContent);
        if (!president && roles.president) president = roles.president;
        if (!secretary && roles.secretary) secretary = roles.secretary;
      } catch (err: any) {
        console.warn('Erreur lecture PV:', err.message);
      }
    }

    // Récupérer les notes en attente depuis ChurchTools
    let preparationNotes: any[] = [];
    try {
      preparationNotes = await churchToolsService.getPendingNotes();
    } catch (e: any) {
      console.warn('Erreur notes ChurchTools:', e.message);
    }

    // Extraire la date si pas encore déterminée
    if (!dateStr && folderName) {
      const m = folderName.match(/^CP\s+(\d{2})\.(\d{2})/i);
      if (m) dateStr = `2026-${m[1]}-${m[2]}`;
    }

    return {
      folderId,
      folderName: folderName || `Dossier ${folderId}`,
      dateStr: dateStr || new Date().toISOString().split('T')[0],
      year: 2026,
      displayTitle: folderName || 'Séance',
      hasOj: Boolean(ojFileId),
      ojFileId,
      ojFileName,
      hasPv: Boolean(pvFileId),
      pvFileId,
      pvFileName,
      president,
      secretary,
      attachmentsCount: folderFiles.length,
      isUpcoming: dateStr ? new Date(dateStr).getTime() >= new Date().setHours(0, 0, 0, 0) : false,
      kdriveUrl: `https://kdrive.infomaniak.com/app/drive/${kDriveService.driveId}/files/${folderId}`,
      ojContent,
      pvContent,
      files: folderFiles,
      preparationNotes,
    };
  }
}

export const meetingsService = new MeetingsService();
