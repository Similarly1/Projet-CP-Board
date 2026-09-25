import { Meeting, Note, Task, Person, KDriveFile, SystemStatus, KDriveSession, CommitteeMember, MeetingSummary, MeetingDetails } from '../types';

let authToken: string | null = localStorage.getItem('cp_board_auth_token');

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('cp_board_auth_token', token);
  } else {
    localStorage.removeItem('cp_board_auth_token');
  }
};

export const getAuthToken = () => authToken;

const customFetch = async (url: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers || {});
  
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    setAuthToken(null);
    window.dispatchEvent(new CustomEvent('auth-unauthorized'));
    throw new Error('Session expirée ou mot de passe requis.');
  }

  if (response.status === 429) {
    window.dispatchEvent(new CustomEvent('api-rate-limited', {
      detail: { message: 'Limite de requêtes kDrive atteinte (HTTP 429). Ralentissez légèrement vos actions.' }
    }));
    throw new Error('Limite de requêtes atteinte (HTTP 429).');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Erreur serveur (${response.status})`);
  }

  return data;
};

export const api = {
  getAuthToken,
  setAuthToken,

  // Statut & Auth
  async getStatus(): Promise<SystemStatus> {
    return customFetch('/api/status');
  },

  async checkAuth(): Promise<{ authRequired: boolean; authenticated: boolean; user?: any; hasChurchToolsOAuth?: boolean }> {
    return customFetch('/api/auth/check');
  },

  async login(password: string): Promise<{ success: boolean; token: string; user?: any }> {
    const res = await customFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.token) {
      setAuthToken(res.token);
    }
    if (res.user?.name) {
      localStorage.setItem('cp_board_user_name', res.user.name);
    }
    return res;
  },

  async logout(): Promise<void> {
    try {
      await customFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignorer
    }
    setAuthToken(null);
    localStorage.removeItem('cp_board_user_name');
    window.location.reload();
  },

  // Réunions unifiées (dossiers CP MM.DD kDrive + ChurchTools)
  async getMeetingsList(year = 2026): Promise<MeetingSummary[]> {
    const res = await customFetch(`/api/meetings?year=${year}`);
    return res.meetings || [];
  },

  async getMeetingDetails(folderId: string | number): Promise<MeetingDetails> {
    const res = await customFetch(`/api/meetings/${folderId}`);
    return res.details;
  },

  async createMeetingFolder(payload: { dateStr: string; topic?: string }): Promise<{ success: boolean; folder: any }> {
    return customFetch('/api/meetings/create-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async saveMeetingOj(folderId: string | number, payload: { content: string; meetingDate?: string }): Promise<{ success: boolean; docxFile: any }> {
    return customFetch(`/api/meetings/${folderId}/save-oj`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async saveMeetingPv(
    folderId: string | number,
    payload: { content: string; meetingDate?: string; docxTitle?: string; syncTasks?: boolean }
  ): Promise<{ success: boolean; docxFile: any; syncedTaskCount: number }> {
    return customFetch(`/api/meetings/${folderId}/save-pv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async uploadAttachment(folderId: string | number, file: File): Promise<{ success: boolean; file: any }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderId', String(folderId));

    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch('/api/files/upload', {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Erreur lors du téléversement');
    }
    return data;
  },

  // Anciennes méthodes de compatibilité
  async getUpcomingMeetings(refresh = false): Promise<Meeting[]> {
    const res = await customFetch(`/api/meetings/upcoming${refresh ? '?refresh=true' : ''}`);
    return res.meetings || [];
  },

  async getSessions(): Promise<KDriveSession[]> {
    const res = await customFetch('/api/meetings/sessions');
    return res.sessions || [];
  },

  async initMeeting(payload: {
    meetingDate: string;
    title?: string;
    selectedNoteIds?: (string | number)[];
    customNotes?: string;
  }): Promise<{
    success: boolean;
    folderId: string | number;
    folderName: string;
    odjFileId: string | number;
    odjFileName: string;
  }> {
    return customFetch('/api/meetings/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async startPv(payload: {
    meetingDate: string;
    folderId: string | number;
  }): Promise<{
    pvFileId: string | number;
    pvFileName: string;
    content: string;
    alreadyExisted: boolean;
  }> {
    return customFetch('/api/meetings/pv/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  // Notes de Groupe ChurchTools
  async getPendingNotes(): Promise<Note[]> {
    const res = await customFetch('/api/notes/pending');
    return res.notes || [];
  },

  async createNote(text: string): Promise<Note> {
    const res = await customFetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return res.note;
  },

  // Tâches Administratives (Taches_Comite.md)
  async getTasks(): Promise<Task[]> {
    const res = await customFetch('/api/tasks');
    return res.tasks || [];
  },

  async addTask(task: {
    title: string;
    assignee?: string;
    dueDate?: string;
    refMeeting?: string;
  }): Promise<Task> {
    const res = await customFetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    return res.task;
  },

  async toggleTask(index: number, completed?: boolean): Promise<Task> {
    const res = await customFetch(`/api/tasks/${index}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
    return res.task;
  },

  // Fichiers et Contenu kDrive
  async getFileContent(fileId: string | number): Promise<string> {
    const res = await customFetch(`/api/files/${fileId}/content`);
    return res.content || '';
  },

  async saveFileContent(payload: {
    fileId: string | number;
    content: string;
    parentFolderId?: string | number;
    fileName?: string;
  }): Promise<any> {
    return customFetch(`/api/files/${payload.fileId}/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async getFolderFiles(folderId: string | number): Promise<KDriveFile[]> {
    const res = await customFetch(`/api/files/folder/${folderId}`);
    return res.files || [];
  },

  async uploadFile(folderId: string | number, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('folderId', String(folderId));
    formData.append('file', file);

    const headers = new Headers();
    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }

    const response = await fetch('/api/files/upload', {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Erreur lors du téléversement');
    }
    return data;
  },

  async getCommitteeMembers(): Promise<CommitteeMember[]> {
    const res = await customFetch('/api/churchtools/members');
    return res.members || [];
  },

  async saveAndExportDocx(payload: {
    folderId: string | number;
    fileName?: string;
    content: string;
    docxTitle?: string;
    meetingDate?: string;
    syncTasks?: boolean;
  }): Promise<any> {
    return customFetch('/api/files/save-and-export-docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  // ChurchTools Persons & Follow-ups
  async searchPersons(query: string): Promise<Person[]> {
    const res = await customFetch(`/api/churchtools/persons?q=${encodeURIComponent(query)}`);
    return res.persons || [];
  },

  async createFollowUp(payload: {
    targetPersonId: number;
    assigneePersonId?: number;
    comment: string;
    dueDate?: string;
  }): Promise<any> {
    return customFetch('/api/churchtools/followups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },
};
