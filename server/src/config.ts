import path from 'path';
import dotenv from 'dotenv';

// Load .env from server dir or root dir
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  appPassword?: string;
  churchTools: {
    baseUrl: string;
    token: string;
    committeeGroupId: number;
    isConfigured: boolean;
  };
  kDrive: {
    apiBaseUrl: string;
    token: string;
    driveId: number;
    rootFolderId: number;
    isConfigured: boolean;
  };
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appPassword: process.env.APP_PASSWORD || undefined,
  churchTools: {
    baseUrl: (process.env.CHURCHTOOLS_BASE_URL || '').replace(/\/$/, ''),
    token: process.env.CHURCHTOOLS_API_TOKEN || '',
    committeeGroupId: parseInt(process.env.CHURCHTOOLS_COMMITTEE_GROUP_ID || '0', 10),
    get isConfigured() {
      return Boolean(this.baseUrl && this.token);
    },
  },
  kDrive: {
    apiBaseUrl: (process.env.KDRIVE_API_BASE_URL || 'https://api.infomaniak.com/3').replace(/\/$/, ''),
    token: process.env.KDRIVE_API_TOKEN || '',
    driveId: parseInt(process.env.KDRIVE_DRIVE_ID || '0', 10),
    rootFolderId: parseInt(process.env.KDRIVE_ROOT_FOLDER_ID || '0', 10),
    get isConfigured() {
      return Boolean(this.token && this.driveId);
    },
  },
};
