import { Router, Request, Response } from 'express';
import { config } from '../config';

const router = Router();

// Middleware de vérification d'authentification
export const requireAuth = (req: Request, res: Response, next: () => void) => {
  if (!config.appPassword) {
    return next(); // Pas de mot de passe configuré, accès libre
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (token === config.appPassword) {
    return next();
  }

  return res.status(401).json({ error: 'Accès non autorisé. Mot de passe de session requis.' });
};

router.get('/check', (req, res) => {
  const isAuthRequired = Boolean(config.appPassword);
  let isAuthenticated = true;

  if (isAuthRequired) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    isAuthenticated = token === config.appPassword;
  }

  res.json({
    authRequired: isAuthRequired,
    authenticated: isAuthenticated,
  });
});

router.post('/login', (req, res) => {
  const { password } = req.body;

  if (!config.appPassword) {
    return res.json({ success: true, token: 'no-password-needed' });
  }

  if (password === config.appPassword) {
    return res.json({ success: true, token: password });
  }

  return res.status(401).json({ error: 'Mot de passe incorrect.' });
});

export default router;
