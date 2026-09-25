import { Meeting, Note, Task, Person, KDriveFile, SystemStatus } from '../types';

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
  // Statut & Auth
  async getStatus(): Promise<SystemStatus> {
    return customFetch('/api/status');
  },

  async checkAuth(): Promise<{ authRequired: boolean; authenticated: boolean }> {
    return customFetch('/api/auth/check');
  },

  async login(password: string): Promise<{ success: boolean; token: string }> {
    const res = await customFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },

  // Réunions (ChurchTools + kDrive)
  async getUpcomingMeetings(refresh = false): Promise<Meeting[]> {
    const res = await customFetch(`/api/meetings/upcoming${refresh ? '?refresh=true' : ''}`);
    return res.meetings || [];
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
