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
    folderUrl?: string;
    hasFolder: boolean;
    odjFileId?: string | number;
    odjName?: string;
    odjUrl?: string;
    odjIsDocx?: boolean;
    pvFileId?: string | number;
    pvName?: string;
    pvUrl?: string;
    pvIsDocx?: boolean;
  };
}

export interface KDriveSession {
  id: number | string;
  name: string;
  kdriveUrl: string;
  fileCount: number;
  odj?: {
    id: number | string;
    name: string;
    kdriveUrl: string;
    isDocx: boolean;
    isPdf: boolean;
    isMd: boolean;
  } | null;
  pv?: {
    id: number | string;
    name: string;
    kdriveUrl: string;
    isDocx: boolean;
    isPdf: boolean;
    isMd: boolean;
  } | null;
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

export interface MeetingSummary {
  folderId?: number | string;
  folderName: string;
  dateStr: string;
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
  churchToolsAppointment?: any;
  isUpcoming: boolean;
  kdriveUrl?: string;
}

export interface MeetingDetails extends MeetingSummary {
  ojContent: string;
  pvContent: string;
  files: KDriveFile[];
  preparationNotes: { id: number; text: string; authorName?: string; createdAt?: string }[];
}
