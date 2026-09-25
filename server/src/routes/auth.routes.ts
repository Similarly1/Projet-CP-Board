import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { config } from '../config';
import { cacheService } from '../db/database';

const router = Router();

// Durée de validité d'une session : 30 jours
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Middleware de vérification d'authentification
export const requireAuth = (req: Request, res: Response, next: () => void) => {
  // Si ni mot de passe ni OAuth configuré, accès libre
  if (!config.appPassword && !config.churchTools.clientId) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return res.status(401).json({ error: 'Accès non autorisé. Authentification requise.' });
  }

  // 1. Vérification par mot de passe global
  if (config.appPassword && token === config.appPassword) {
    return next();
  }

  // 2. Vérification par session OAuth ChurchTools
  const session = cacheService.get<{ userId: string | number; name: string; email?: string }>(`session:${token}`);
  if (session) {
    (req as any).user = session;
    return next();
  }

  return res.status(401).json({ error: 'Session expirée ou non autorisée. Veuillez vous reconnecter.' });
};

// Vérification du statut d'authentification
router.get('/check', (req, res) => {
  const isAuthRequired = Boolean(config.appPassword || config.churchTools.clientId);
  let isAuthenticated = !isAuthRequired;
  let currentUser: any = null;

  if (isAuthRequired) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (token) {
      if (config.appPassword && token === config.appPassword) {
        isAuthenticated = true;
        currentUser = { name: 'Membre du Comité' };
      } else {
        const session = cacheService.get<{ userId: string | number; name: string; email?: string }>(`session:${token}`);
        if (session) {
          isAuthenticated = true;
          currentUser = session;
        }
      }
    }
  }

  res.json({
    authRequired: isAuthRequired,
    authenticated: isAuthenticated,
    user: currentUser,
    hasChurchToolsOAuth: Boolean(config.churchTools.clientId),
  });
});

// Connexion classique par mot de passe global
router.post('/login', (req, res) => {
  const { password } = req.body;

  if (!config.appPassword) {
    return res.json({ success: true, token: 'no-password-needed' });
  }

  if (password === config.appPassword) {
    return res.json({ success: true, token: password, user: { name: 'Membre du Comité' } });
  }

  return res.status(401).json({ error: 'Mot de passe incorrect.' });
});

// 1. Redirection vers la page de login OAuth de ChurchTools
router.get('/churchtools/login', (req, res) => {
  if (!config.churchTools.clientId) {
    return res.status(400).send('OAuth ChurchTools non configuré (CHURCHTOOLS_CLIENT_ID manquant).');
  }

  const redirectUri = config.churchTools.redirectUri || 'http://localhost:3000/api/auth/churchtools/callback';
  const authorizeUrl = `${config.churchTools.baseUrl}/oauth/authorize?client_id=${config.churchTools.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;

  res.redirect(authorizeUrl);
});

// 2. Callback de retour après validation sur ChurchTools
router.get('/churchtools/callback', async (req, res) => {
  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error || !code) {
    console.error('Erreur retour OAuth ChurchTools:', error || 'Code manquant');
    return res.redirect('/?auth_error=' + encodeURIComponent(error || 'Connexion annulée'));
  }

  try {
    const redirectUri = config.churchTools.redirectUri || 'http://localhost:3000/api/auth/churchtools/callback';

    // Échange du code d'autorisation contre un token d'accès
    // Supporte application/x-www-form-urlencoded standard OAuth
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', config.churchTools.clientId || '');
    params.append('redirect_uri', redirectUri);
    params.append('code', code);

    const tokenResponse = await axios.post(`${config.churchTools.baseUrl}/oauth/access_token`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    });

    const accessToken = tokenResponse.data?.access_token || tokenResponse.data?.accessToken;
    if (!accessToken) {
      throw new Error("Jeton d'accès manquant dans la réponse de ChurchTools.");
    }

    // Récupération du profil utilisateur (userinfo)
    const userinfoResponse = await axios.get(`${config.churchTools.baseUrl}/oauth/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    const userData = userinfoResponse.data;
    const userId = userData.id || userData.sub || userData.personId;
    const userName = userData.name || userData.displayName || `${userData.given_name || ''} ${userData.family_name || ''}`.trim() || 'Membre';
    const userEmail = userData.email || '';

    // Génération d'un token de session pour notre application
    const sessionToken = crypto.randomBytes(32).toString('hex');
    cacheService.set(`session:${sessionToken}`, {
      userId,
      name: userName,
      email: userEmail,
    }, SESSION_TTL_MS);

    console.log(`[AUTH] Connexion ChurchTools réussie pour ${userName} (${userEmail})`);

    // Redirection vers le tableau de bord avec le token en paramètre
    return res.redirect(`/?auth_token=${sessionToken}&auth_user=${encodeURIComponent(userName)}`);
  } catch (err: any) {
    console.error('Erreur lors du callback OAuth ChurchTools:', err.response?.data || err.message);
    const msg = err.response?.data?.error_description || err.response?.data?.message || err.message;
    return res.redirect('/?auth_error=' + encodeURIComponent(`Erreur d'authentification: ${msg}`));
  }
});

// Déconnexion
router.post('/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (token) {
    cacheService.invalidate(`session:${token}`);
  }

  res.json({ success: true });
});

export default router;
