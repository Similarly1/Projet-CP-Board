import { Router } from 'express';
import { config } from '../config';
import { churchToolsService } from '../services/churchtools.service';
import { kDriveService } from '../services/kdrive.service';

const router = Router();

router.get('/', async (req, res) => {
  const status = {
    churchTools: {
      configured: config.churchTools.isConfigured,
      baseUrl: config.churchTools.baseUrl,
      groupId: config.churchTools.committeeGroupId,
      connected: false,
      error: null as string | null,
    },
    kDrive: {
      configured: config.kDrive.isConfigured,
      apiBaseUrl: config.kDrive.apiBaseUrl,
      driveId: config.kDrive.driveId,
      rootFolderId: config.kDrive.rootFolderId,
      connected: false,
      error: null as string | null,
    },
    sqlite: {
      connected: true,
      path: 'data/app.db',
    },
    serverTime: new Date().toISOString(),
  };

  // Tester ChurchTools si configuré
  if (config.churchTools.isConfigured) {
    try {
      await churchToolsService.getUpcomingMeetings();
      status.churchTools.connected = true;
    } catch (err: any) {
      status.churchTools.error = err.message;
    }
  }

  // Tester kDrive si configuré
  if (config.kDrive.isConfigured) {
    try {
      await kDriveService.listFiles(config.kDrive.rootFolderId);
      status.kDrive.connected = true;
    } catch (err: any) {
      status.kDrive.error = err.message;
    }
  }

  res.json(status);
});

export default router;
