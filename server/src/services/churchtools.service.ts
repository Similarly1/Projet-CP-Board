import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { cacheService } from '../db/database';

export interface ChurchToolsMeeting {
  id: number | string;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  description?: string;
  calendarName?: string;
}

export interface ChurchToolsNote {
  id: number | string;
  text: string;
  authorName?: string;
  createdAt: string;
  isArchived?: boolean;
}

export interface ChurchToolsPerson {
  id: number;
  firstName: string;
  lastName: string;
  displayName: string;
  email?: string;
  imageUrl?: string;
}

export interface CommitteeMember {
  id: number;
  firstName: string;
  lastName: string;
  displayName: string;
  mentionName: string;
  role?: string;
  email?: string;
}

export class ChurchToolsService {
  private get client(): AxiosInstance {
    if (!config.churchTools.baseUrl || !config.churchTools.token) {
      throw new Error("L'intégration ChurchTools n'est pas configurée dans les variables d'environnement (CHURCHTOOLS_BASE_URL et CHURCHTOOLS_API_TOKEN requis).");
    }

    return axios.create({
      baseURL: config.churchTools.baseUrl,
      headers: {
        Authorization: `Login ${config.churchTools.token}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  /**
   * Vérifie si un rendez-vous ChurchTools correspond exclusivement à une rencontre du CP.
   * Exclut le Comité d'Eglise (AE / CE), les Assemblées de délégués, l'EMP, etc.
   */
  isCpMeeting(title: string): boolean {
    if (!title) return false;
    const lower = title.toLowerCase();

    // 1. Exclure explicitement CE (Comité d'Église / AE), Assemblée des délégués, etc.
    if (
      lower.includes("comité d'eglise") ||
      lower.includes("comite d'eglise") ||
      lower.includes("comité d'église") ||
      lower.includes("comite d'église") ||
      lower.includes('(ae)') ||
      lower.includes('délégué') ||
      lower.includes('delegue') ||
      lower.includes('assemblée des') ||
      lower.includes('assemblee des') ||
      lower.includes('ag ') ||
      lower.includes('assemblée générale') ||
      lower.includes('assemblee generale')
    ) {
      return false;
    }

    // 2. Doit être expressément une rencontre ou séance du CP
    return (
      /\bcp\b/i.test(title) ||
      lower.includes('conseil pastoral') ||
      lower.includes('comité pastoral') ||
      lower.includes('comite pastoral')
    );
  }

  /**
   * Récupère les prochaines réunions (avec cache de 30 minutes)
   */
  async getUpcomingMeetings(forceRefresh = false): Promise<ChurchToolsMeeting[]> {
    const cacheKey = 'churchtools_upcoming_meetings';
    if (!forceRefresh) {
      const cached = cacheService.get<ChurchToolsMeeting[]>(cacheKey);
      if (cached) return cached;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    
    try {
      const calendarId = config.churchTools.calendarId;
      const meetings: ChurchToolsMeeting[] = [];

      if (calendarId) {
        try {
          // Requête directe sur le calendrier du comité (ID 4: CP & EMP • CE & EMS)
          const nextYearStr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const apptResponse = await this.client.get(`/api/calendars/${calendarId}/appointments`, {
            params: {
              from: todayStr,
              to: nextYearStr,
            },
          });

          const apptData = apptResponse.data?.data || [];
          for (const item of apptData) {
            const base = item.base || item.appointment?.base || {};
            const calc = item.calculated || item.appointment?.calculated || {};
            const title = base.title || base.caption || item.title || 'Séance Comité';
            const startDate = calc.startDate || base.startDate;
            const endDate = calc.endDate || base.endDate;
            let location = '';
            const rawLoc = base.address || base.location || item.appointment?.address || item.appointment?.location;
            if (typeof rawLoc === 'string') {
              location = rawLoc;
            } else if (rawLoc && typeof rawLoc === 'object') {
              location = rawLoc.name || rawLoc.meetingAt || rawLoc.street || '';
              if (rawLoc.city) location += ` (${rawLoc.city})`;
            }
            const description = base.description || base.subtitle || '';

            // Filtrage strict : uniquement les séances ou rencontres du CP (exclut CE, EMP, Assemblées...)
            if (startDate && this.isCpMeeting(title)) {
              meetings.push({
                id: base.id || item.id || `${startDate}_${title}`,
                title,
                startDate,
                endDate,
                location,
                description,
                calendarName: 'CP & EMP • CE & EMS',
              });
            }
          }
        } catch (e: any) {
          console.warn('Erreur récupération appointments calendrier:', e.message);
        }
      }

      // Si aucun rdv trouvé via appointments ou pas de calendrier configuré, fallback sur /api/events
      if (meetings.length === 0) {
        const response = await this.client.get('/api/events', {
          params: {
            from: todayStr,
            direction: 'forward',
            limit: 30,
          },
        });

        const eventsData = response.data?.data || response.data || [];
        for (const item of eventsData) {
          const title = item.name || item.title || 'Séance';
          const startDate = item.startDate || item.start || item.appointment?.startDate;
          const endDate = item.endDate || item.end || item.appointment?.endDate;
          const location = item.location || item.appointment?.address || '';
          const description = item.description || item.appointment?.description || '';
          const calendarName = item.calendar?.name || '';

          if (startDate && this.isCpMeeting(title)) {
            meetings.push({
              id: item.id || `${startDate}_${title}`,
              title,
              startDate,
              endDate,
              location,
              description,
              calendarName,
            });
          }
        }
      }

      // Tri chronologique
      meetings.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      // Sauvegarde dans le cache pendant 30 minutes (1800000 ms)
      cacheService.set(cacheKey, meetings, 30 * 60 * 1000);
      return meetings;
    } catch (err: any) {
      console.error('Erreur lors de la récupération des réunions ChurchTools:', err.response?.data || err.message);
      throw new Error(`Erreur ChurchTools API: ${err.response?.data?.message || err.message}`);
    }
  }

  /**
   * Récupère les membres officiels du groupe comité (CP)
   */
  async getCommitteeMembers(): Promise<CommitteeMember[]> {
    const groupId = config.churchTools.committeeGroupId;
    if (!groupId) return [];

    const cacheKey = 'churchtools_committee_members';
    const cached = cacheService.get<CommitteeMember[]>(cacheKey);
    if (cached) return cached;

    try {
      const res = await this.client.get(`/api/groups/${groupId}/members`);
      const data = res.data?.data || [];
      const members: CommitteeMember[] = [];

      for (const m of data) {
        const p = m.person || {};
        const personId = m.personId || p.id || m.id;
        const firstName = p.domainAttributes?.firstName || p.firstName || '';
        const lastName = p.domainAttributes?.lastName || p.lastName || '';
        const fullName = (p.title || `${firstName} ${lastName}`).trim() || `Membre #${personId}`;
        const firstPart = firstName || fullName.split(' ')[0] || fullName;

        members.push({
          id: personId,
          firstName,
          lastName,
          displayName: fullName,
          mentionName: firstPart.replace(/\s+/g, '-'),
          role: m.groupTypeRole?.name || m.role,
          email: p.domainAttributes?.email || p.email,
        });
      }

      cacheService.set(cacheKey, members, 60 * 60 * 1000);
      return members;
    } catch (err: any) {
      console.error('Erreur getCommitteeMembers:', err.message);
      return [];
    }
  }

  /**
   * Récupère les notes en attente du groupe comité
   */
  async getPendingNotes(): Promise<ChurchToolsNote[]> {
    const groupId = config.churchTools.committeeGroupId;
    if (!groupId) {
      throw new Error("L'identifiant du groupe comité CHURCHTOOLS_COMMITTEE_GROUP_ID n'est pas configuré.");
    }

    try {
      // GET /api/groups/{groupId}/notes
      const response = await this.client.get(`/api/groups/${groupId}/notes`);
      const rawNotes = response.data?.data || response.data || [];

      return rawNotes.map((n: any) => ({
        id: n.id,
        text: n.text || n.comment || n.note || '',
        authorName: n.person ? `${n.person.firstName || ''} ${n.person.lastName || ''}`.trim() : (n.author || 'Inconnu'),
        createdAt: n.createdAt || n.created_at || new Date().toISOString(),
        isArchived: Boolean(n.isArchived || n.archived),
      })).filter((n: ChurchToolsNote) => !n.isArchived);
    } catch (err: any) {
      if (err.response?.status === 404) {
        return [];
      }
      console.warn('Erreur lors de la récupération des notes de groupe ChurchTools:', err.response?.data?.message || err.message);
      return [];
    }
  }

  /**
   * Ajoute une note rapide au groupe comité
   */
  async createNote(text: string): Promise<ChurchToolsNote> {
    const groupId = config.churchTools.committeeGroupId;
    if (!groupId) {
      throw new Error("L'identifiant du groupe comité CHURCHTOOLS_COMMITTEE_GROUP_ID n'est pas configuré.");
    }

    try {
      const response = await this.client.post(`/api/groups/${groupId}/notes`, {
        text,
        comment: text,
      });

      const resData = response.data?.data || response.data;
      return {
        id: resData.id || Date.now(),
        text,
        authorName: 'Moi',
        createdAt: new Date().toISOString(),
        isArchived: false,
      };
    } catch (err: any) {
      console.error('Erreur lors de la création d une note ChurchTools:', err.response?.data || err.message);
      throw new Error(`Erreur ChurchTools API (Création Note): ${err.response?.data?.message || err.message}`);
    }
  }

  /**
   * Recherche de personnes pour l'autocomplétion
   */
  async searchPersons(query: string): Promise<ChurchToolsPerson[]> {
    try {
      const response = await this.client.get('/api/persons', {
        params: {
          query: query || '',
          limit: 20,
        },
      });

      const rawPersons = response.data?.data || response.data || [];
      return rawPersons.map((p: any) => ({
        id: p.id,
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        displayName: `${p.firstName || ''} ${p.lastName || ''}`.trim() || `Personne #${p.id}`,
        email: p.email || p.emails?.[0]?.email,
        imageUrl: p.imageUrl || p.meta?.imageUrl,
      }));
    } catch (err: any) {
      console.error('Erreur lors de la recherche de personnes ChurchTools:', err.response?.data || err.message);
      throw new Error(`Erreur ChurchTools API (Personnes): ${err.response?.data?.message || err.message}`);
    }
  }

  /**
   * Crée un suivi pastoral / relationnel (Follow-up)
   */
  async createFollowUp(payload: {
    targetPersonId: number;
    assigneePersonId?: number;
    comment: string;
    dueDate?: string;
  }): Promise<any> {
    try {
      const response = await this.client.post('/api/followups', {
        personId: payload.targetPersonId,
        assignedPersonId: payload.assigneePersonId,
        comment: payload.comment,
        dueTo: payload.dueDate,
      });

      return response.data?.data || response.data;
    } catch (err: any) {
      console.error('Erreur lors de la création du follow-up ChurchTools:', err.response?.data || err.message);
      throw new Error(`Erreur ChurchTools API (Follow-up): ${err.response?.data?.message || err.message}`);
    }
  }
}

export const churchToolsService = new ChurchToolsService();
