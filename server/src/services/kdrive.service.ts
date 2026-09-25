import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import FormData from 'form-data';
import { config } from '../config';

export interface KDriveItem {
  id: number | string;
  name: string;
  type: 'dir' | 'file';
  size?: number;
  updatedAt?: string;
  mimetype?: string;
  kdriveUrl?: string;
}

export class KDriveService {
  private lastRequestTime = 0;
  private readonly minDelayMs = 100; // Minimum 100ms between calls to prevent rate-limiting

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minDelayMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private get client(): AxiosInstance {
    if (!config.kDrive.token || !config.kDrive.driveId) {
      throw new Error("L'intégration Infomaniak kDrive n'est pas configurée dans les variables d'environnement (KDRIVE_API_TOKEN et KDRIVE_DRIVE_ID requis).");
    }

    const instance = axios.create({
      baseURL: config.kDrive.apiBaseUrl,
      headers: {
        Authorization: `Bearer ${config.kDrive.token}`,
      },
      timeout: 30000,
    });

    // Interceptor to enforce minimum delay between calls
    instance.interceptors.request.use(async (reqConfig) => {
      await this.throttle();
      return reqConfig;
    });

    // Interceptor to handle HTTP 429
    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 429) {
          console.warn('kDrive API Rate Limited (HTTP 429). Retrying after backoff...');
          await new Promise((r) => setTimeout(r, 1500));
          return instance.request(error.config);
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }

  get driveId(): number {
    return config.kDrive.driveId;
  }

  get rootFolderId(): number {
    return config.kDrive.rootFolderId;
  }

  /**
   * Liste les fichiers et dossiers dans un dossier parent
   */
  async listFiles(folderId: number | string = this.rootFolderId): Promise<KDriveItem[]> {
    try {
      // GET /drive/{driveId}/files/{folderId}/files
      const response = await this.client.get(`/drive/${this.driveId}/files/${folderId}/files`, {
        params: {
          limit: 100,
        },
      });

      const items = response.data?.data || response.data?.result || response.data || [];
      return items.map((item: any) => ({
        id: item.id,
        name: item.name,
        type: item.type === 'dir' || item.is_dir ? 'dir' : 'file',
        size: item.size,
        updatedAt: item.last_modified_at || item.updated_at,
        mimetype: item.mimetype,
        kdriveUrl: `https://kdrive.infomaniak.com/app/drive/${this.driveId}/files/${item.id}`,
      }));
    } catch (err: any) {
      console.error(`Erreur listFiles kDrive (dossier ${folderId}):`, err.response?.data || err.message);
      throw new Error(`Erreur kDrive: ${err.response?.data?.message || err.message}`);
    }
  }

  /**
   * Recherche un dossier ou fichier par nom dans un dossier donné
   */
  async findItemByName(parentFolderId: number | string, name: string): Promise<KDriveItem | null> {
    const items = await this.listFiles(parentFolderId);
    return items.find((item) => item.name.toLowerCase() === name.toLowerCase()) || null;
  }

  /**
   * Crée un nouveau sous-dossier
   */
  async createDirectory(parentFolderId: number | string, name: string): Promise<KDriveItem> {
    // Vérifier si le dossier existe déjà
    const existing = await this.findItemByName(parentFolderId, name);
    if (existing && existing.type === 'dir') {
      return existing;
    }

    try {
      // POST /drive/{driveId}/files/{folderId}/directory
      const response = await this.client.post(`/drive/${this.driveId}/files/${parentFolderId}/directory`, {
        name,
      });

      const data = response.data?.data || response.data;
      return {
        id: data.id,
        name: data.name || name,
        type: 'dir',
        kdriveUrl: `https://kdrive.infomaniak.com/app/drive/${this.driveId}/files/${data.id}`,
      };
    } catch (err: any) {
      console.error(`Erreur création répertoire kDrive (${name}):`, err.response?.data || err.message);
      throw new Error(`Erreur kDrive (Création dossier): ${err.response?.data?.message || err.message}`);
    }
  }

  /**
   * Téléverse un fichier (ou crée/écrase un fichier Markdown)
   */
  async uploadFile(
    parentFolderId: number | string,
    fileName: string,
    fileBuffer: Buffer,
    mimeType = 'text/markdown'
  ): Promise<KDriveItem> {
    try {
      const form = new FormData();
      form.append('file', fileBuffer, {
        filename: fileName,
        contentType: mimeType,
      });
      form.append('directory_id', String(parentFolderId));
      form.append('conflict_action', 'replace'); // Écrase si existe déjà

      const response = await this.client.post(`/drive/${this.driveId}/files/upload`, form, {
        headers: {
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const data = response.data?.data || response.data;
      return {
        id: data.id,
        name: data.name || fileName,
        type: 'file',
        size: data.size || fileBuffer.length,
        kdriveUrl: `https://kdrive.infomaniak.com/app/drive/${this.driveId}/files/${data.id}`,
      };
    } catch (err: any) {
      console.error(`Erreur upload fichier kDrive (${fileName}):`, err.response?.data || err.message);
      throw new Error(`Erreur kDrive (Upload): ${err.response?.data?.message || err.message}`);
    }
  }

  /**
   * Crée ou met à jour un fichier texte / markdown
   */
  async saveTextFile(
    parentFolderId: number | string,
    fileName: string,
    content: string
  ): Promise<KDriveItem> {
    const buffer = Buffer.from(content, 'utf-8');
    return this.uploadFile(parentFolderId, fileName, buffer, 'text/markdown');
  }

  /**
   * Récupère le contenu textuel d'un fichier (ex: Markdown)
   */
  async getFileTextContent(fileId: number | string): Promise<string> {
    try {
      // GET /drive/{driveId}/files/{fileId}/download
      const response = await this.client.get(`/drive/${this.driveId}/files/${fileId}/download`, {
        responseType: 'text',
        transformResponse: [(data) => data],
      });

      return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    } catch (err: any) {
      console.error(`Erreur lecture fichier kDrive (${fileId}):`, err.response?.data || err.message);
      throw new Error(`Erreur kDrive (Lecture fichier): ${err.response?.data?.message || err.message}`);
    }
  }

  /**
   * Met à jour le contenu d'un fichier existant
   */
  async updateFileContent(
    parentFolderId: number | string,
    fileId: number | string,
    fileName: string,
    content: string
  ): Promise<KDriveItem> {
    const buffer = Buffer.from(content, 'utf-8');
    
    // Tente l'upload avec remplacement dans le dossier parent
    return this.uploadFile(parentFolderId, fileName, buffer, 'text/markdown');
  }
}

export const kDriveService = new KDriveService();
