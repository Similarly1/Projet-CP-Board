import { kDriveService } from './kdrive.service';

export interface TaskItem {
  id: number; // Index de la ligne dans le fichier
  rawLine: string;
  completed: boolean;
  title: string;
  assignee: string | null;
  dueDate: string | null;
  refMeeting: string | null;
  isOverdue: boolean;
  isDueSoon: boolean;
}

export class TasksService {
  private readonly fileName = 'Taches_Comite.md';

  /**
   * Trouve ou initialise le fichier Taches_Comite.md sur kDrive
   */
  async getTasksFile(): Promise<{ fileId: string | number; content: string }> {
    const rootFolderId = kDriveService.rootFolderId;
    const existing = await kDriveService.findItemByName(rootFolderId, this.fileName);

    if (existing) {
      const content = await kDriveService.getFileTextContent(existing.id);
      return { fileId: existing.id, content };
    }

    // Le fichier n'existe pas encore, on le crée avec l'en-tête standard
    const initialContent = `# Registre des Tâches Administratives du Comité

> Format standard : - [ ] Intitulé | @Assigné | AAAA-MM-JJ | Réf: AAAA-MM-JJ

- [ ] Préparer l'ordre du jour de la prochaine séance | @Secrétaire | ${new Date().toISOString().split('T')[0]} | Réf: Initial
`;
    const created = await kDriveService.saveTextFile(rootFolderId, this.fileName, initialContent);
    return { fileId: created.id, content: initialContent };
  }

  /**
   * Parse le contenu Markdown en liste d'objets TaskItem
   */
  parseTasks(markdownContent: string): TaskItem[] {
    const lines = markdownContent.split(/\r?\n/);
    const tasks: TaskItem[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysFromNow = today + 7 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Vérifie si la ligne commence par une case à cocher markdown : - [ ] ou - [x] ou * [ ]
      const checkboxMatch = trimmed.match(/^[-*]\s*\[([ xX])\]\s*(.*)$/);
      if (!checkboxMatch) {
        continue;
      }

      const isCompleted = checkboxMatch[1].toLowerCase() === 'x';
      const rest = checkboxMatch[2].trim();

      // Extraction tolérante des segments séparés par pipe '|'
      // Format typique: Intitulé | @Assigné | YYYY-MM-DD | Réf: 2026-10-15
      const parts = rest.split('|').map((p) => p.trim());

      let title = parts[0] || 'Sans titre';
      let assignee: string | null = null;
      let dueDate: string | null = null;
      let refMeeting: string | null = null;

      // Parcours des segments suivants de manière tolérante
      for (let pIndex = 1; pIndex < parts.length; pIndex++) {
        const part = parts[pIndex];
        if (part.startsWith('@')) {
          assignee = part.substring(1).trim();
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
          dueDate = part;
        } else if (/^réf:?/i.test(part)) {
          refMeeting = part.replace(/^réf:?\s*/i, '').trim();
        } else if (!assignee && !dueDate) {
          // Si pas de préfixe particulier, on tente de deviner
          if (part.includes('@')) {
            const m = part.match(/@([^\s|]+)/);
            if (m) assignee = m[1];
          } else {
            // Assigné implicite ou info supplémentaire
            assignee = part;
          }
        }
      }

      // Si l'assigné ou la date était dans le titre sans pipe :
      if (!assignee) {
        const atMatch = title.match(/@([a-zA-Z0-9_\u00C0-\u017F-]+)/);
        if (atMatch) {
          assignee = atMatch[1];
        }
      }

      // Calcul des indicateurs d'urgence
      let isOverdue = false;
      let isDueSoon = false;

      if (dueDate && !isCompleted) {
        const dueTime = new Date(dueDate).getTime();
        if (!isNaN(dueTime)) {
          if (dueTime < today) {
            isOverdue = true;
          } else if (dueTime <= sevenDaysFromNow) {
            isDueSoon = true;
          }
        }
      }

      tasks.push({
        id: i, // Index de ligne dans le fichier Markdown
        rawLine: line,
        completed: isCompleted,
        title,
        assignee,
        dueDate,
        refMeeting,
        isOverdue,
        isDueSoon,
      });
    }

    return tasks;
  }

  /**
   * Formate une tâche en ligne Markdown
   */
  formatTaskLine(task: {
    completed: boolean;
    title: string;
    assignee?: string | null;
    dueDate?: string | null;
    refMeeting?: string | null;
  }): string {
    const check = task.completed ? '[x]' : '[ ]';
    const parts = [task.title.trim()];

    if (task.assignee) {
      const cleanAssignee = task.assignee.startsWith('@') ? task.assignee : `@${task.assignee}`;
      parts.push(cleanAssignee);
    }
    if (task.dueDate) {
      parts.push(task.dueDate);
    }
    if (task.refMeeting) {
      const cleanRef = task.refMeeting.startsWith('Réf:') ? task.refMeeting : `Réf: ${task.refMeeting}`;
      parts.push(cleanRef);
    }

    return `- ${check} ${parts.join(' | ')}`;
  }

  /**
   * Récupère la liste de toutes les tâches
   */
  async getTasks(): Promise<TaskItem[]> {
    const { content } = await this.getTasksFile();
    return this.parseTasks(content);
  }

  /**
   * Bascule ou met à jour le statut d'une tâche à l'index de ligne spécifié
   */
  async toggleTask(lineIndex: number, completed?: boolean): Promise<TaskItem> {
    // 5.2 : Concurrence - récupère la dernière version avant écriture
    const { fileId, content } = await this.getTasksFile();
    const lines = content.split(/\r?\n/);

    if (lineIndex < 0 || lineIndex >= lines.length) {
      throw new Error(`Ligne de tâche invalide (index ${lineIndex})`);
    }

    const targetLine = lines[lineIndex];
    const checkboxMatch = targetLine.match(/^(\s*[-*]\s*)\[([ xX])\](.*)$/);
    if (!checkboxMatch) {
      throw new Error(`La ligne ${lineIndex} n'est pas une tâche Markdown valide.`);
    }

    const currentStatus = checkboxMatch[2].toLowerCase() === 'x';
    const newStatus = typeof completed === 'boolean' ? completed : !currentStatus;
    const newCheckbox = newStatus ? '[x]' : '[ ]';

    lines[lineIndex] = `${checkboxMatch[1]}${newCheckbox}${checkboxMatch[3]}`;

    const newContent = lines.join('\n');
    await kDriveService.updateFileContent(kDriveService.rootFolderId, fileId, this.fileName, newContent);

    const updatedTasks = this.parseTasks(newContent);
    const updated = updatedTasks.find((t) => t.id === lineIndex);
    if (!updated) {
      throw new Error('Erreur lors de la relecture de la tâche mise à jour.');
    }
    return updated;
  }

  /**
   * Ajoute une nouvelle tâche en haut de la liste
   */
  async addTask(data: {
    title: string;
    assignee?: string | null;
    dueDate?: string | null;
    refMeeting?: string | null;
  }): Promise<TaskItem> {
    const { fileId, content } = await this.getTasksFile();
    const lines = content.split(/\r?\n/);

    const newLine = this.formatTaskLine({
      completed: false,
      title: data.title,
      assignee: data.assignee,
      dueDate: data.dueDate,
      refMeeting: data.refMeeting,
    });

    // Trouver où insérer (après les en-têtes markdown # ou >, sinon au début)
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#') || line.startsWith('>') || line === '') {
        insertIndex = i + 1;
      } else {
        break;
      }
    }

    lines.splice(insertIndex, 0, newLine);
    const newContent = lines.join('\n');

    await kDriveService.updateFileContent(kDriveService.rootFolderId, fileId, this.fileName, newContent);

    const updatedTasks = this.parseTasks(newContent);
    const inserted = updatedTasks.find((t) => t.id === insertIndex);
    return (
      inserted || {
        id: insertIndex,
        rawLine: newLine,
        completed: false,
        title: data.title,
        assignee: data.assignee || null,
        dueDate: data.dueDate || null,
        refMeeting: data.refMeeting || null,
        isOverdue: false,
        isDueSoon: false,
      }
    );
  }
}

export const tasksService = new TasksService();
