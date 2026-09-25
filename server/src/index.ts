import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import authRoutes, { requireAuth } from './routes/auth.routes';
import meetingsRoutes from './routes/meetings.routes';
import notesRoutes from './routes/notes.routes';
import filesRoutes from './routes/files.routes';
import tasksRoutes from './routes/tasks.routes';
import churchtoolsRoutes from './routes/churchtools.routes';
import statusRoutes from './routes/status.routes';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging des requêtes API
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Routes publiques
app.use('/api/auth', authRoutes);
app.use('/api/status', statusRoutes);

// Routes protégées par authentification de session
app.use('/api/meetings', requireAuth, meetingsRoutes);
app.use('/api/notes', requireAuth, notesRoutes);
app.use('/api/files', requireAuth, filesRoutes);
app.use('/api/tasks', requireAuth, tasksRoutes);
app.use('/api/churchtools', requireAuth, churchtoolsRoutes);

// En mode production, servir les fichiers statiques du build client
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req: Request, res: Response) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    }
  });
}

// Middleware de gestion globale des erreurs
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Erreur non capturée:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Une erreur interne est survenue sur le serveur.',
  });
});

// Démarrage du serveur
const PORT = config.port;
app.listen(PORT, () => {
  console.log('---------------------------------------------------------');
  console.log(`🚀 Serveur Tableau de Bord Comité démarré sur le port ${PORT}`);
  console.log(`🌍 URL : http://localhost:${PORT}`);
  console.log(`🔧 Mode : ${config.nodeEnv}`);
  console.log(`⛪ ChurchTools configuré : ${config.churchTools.isConfigured ? 'OUI' : 'NON'}`);
  console.log(`📁 Infomaniak kDrive configuré : ${config.kDrive.isConfigured ? 'OUI' : 'NON'}`);
  console.log('---------------------------------------------------------');
});
