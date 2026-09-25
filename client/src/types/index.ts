export interface Meeting {
  id: number | string;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  description?: string;
  calendarName?: string;
  dateStr: string;
  kDrive: {
    folderId?: string | number;
    folderName?: string;
    hasFolder: boolean;
    odjFileId?: string | number;
    pvFileId?: string | number;
  };
}

export interface Note {
  id: number | string;
  text: string;
  authorName?: string;
  createdAt: string;
  isArchived?: boolean;
}

export interface Task {
  id: number;
  rawLine: string;
  completed: boolean;
  title: string;
  assignee: string | null;
  dueDate: string | null;
  refMeeting: string | null;
  isOverdue: boolean;
  isDueSoon: boolean;
}

export interface Person {
  id: number;
  firstName: string;
  lastName: string;
  displayName: string;
  email?: string;
  imageUrl?: string;
}

export interface KDriveFile {
  id: number | string;
  name: string;
  type: 'dir' | 'file';
  size?: number;
  updatedAt?: string;
  mimetype?: string;
  kdriveUrl?: string;
}

export interface SystemStatus {
  churchTools: {
    configured: boolean;
    baseUrl: string;
    groupId: number;
    connected: boolean;
    error: string | null;
  };
  kDrive: {
    configured: boolean;
    apiBaseUrl: string;
    driveId: number;
    rootFolderId: number;
    connected: boolean;
    error: string | null;
  };
  sqlite: {
    connected: boolean;
    path: string;
  };
  serverTime: string;
}
