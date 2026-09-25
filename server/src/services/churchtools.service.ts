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
      // Endpoint standard ChurchTools: GET /api/events?from=YYYY-MM-DD&direction=forward&limit=25
      const response = await this.client.get('/api/events', {
        params: {
          from: todayStr,
          direction: 'forward',
          limit: 30,
        },
      });

      const eventsData = response.data?.data || response.data || [];
      const meetings: ChurchToolsMeeting[] = [];

      for (const item of eventsData) {
        // Filtrage éventuel par nom de groupe / calendrier ou prise en compte des réunions du comité
        const title = item.name || item.title || 'Séance';
        const startDate = item.startDate || item.start || item.appointment?.startDate;
        const endDate = item.endDate || item.end || item.appointment?.endDate;
        const location = item.location || item.appointment?.address || '';
        const description = item.description || item.appointment?.description || '';
        const calendarName = item.calendar?.name || '';

        if (startDate) {
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
      console.error('Erreur lors de la récupération des notes de groupe ChurchTools:', err.response?.data || err.message);
      throw new Error(`Erreur ChurchTools API (Notes): ${err.response?.data?.message || err.message}`);
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
