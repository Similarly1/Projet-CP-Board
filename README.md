# Tableau de Bord Comité (ChurchTools + Infomaniak kDrive)

Application web moderne centralisant la gestion des séances, documents et tâches pour le comité d'église en interconnectant deux plateformes existantes :
1. **ChurchTools (API REST) :** Calendrier des séances, notes préparatoires de groupe et actions relationnelles (*Follow-ups*).
2. **Infomaniak kDrive (API REST v3) :** Dossiers de séances, ordres du jour (`ODJ.md`), procès-verbaux (`PV.md`), annexes et registre des tâches administratives (`Taches_Comite.md`).

---

## 🌟 Principes Clés

* **Zéro enfermement propriétaire (No vendor lock-in) :** Tous les documents et tâches sont des fichiers standards Markdown (`.md`) stockés directement sur kDrive. Si l'application est inaccessible, le comité peut continuer à travailler directement dans kDrive.
* **Backend for Frontend (BFF) Proxy sécurisé :** Aucun token d'API (ChurchTools ou kDrive) ne transite côté navigateur. Le serveur Node.js fait office de proxy sécurisé et gère le cache.
* **Légèreté & Résilience :** Base SQLite locale (`data/app.db`) avec WAL mode pour la mise en cache (ex: 30 minutes sur les réunions) et l'indexation locale des identifiants kDrive.
* **Protection Concurrence & Rate Limiting :** 
  - Débit kDrive régulé avec délai minimal de 100 ms entre requêtes et intercepteur HTTP 429 avec toast clair dans l'UI.
  - Relecture de la dernière version du fichier `Taches_Comite.md` avant toute écriture pour éviter les écrasements concurrents.
  - Parseur Markdown tolérant aux formats non stricts.

---

## 🛠️ Stack Technique

* **Runtime :** Node.js 20+ LTS (testé sous Node 22)
* **Backend :** Express, TypeScript, Better-SQLite3, Axios, Multer
* **Frontend :** React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons

---

## 📁 Structure du Projet

```text
Projet CP Board/
├── .env.example              # Modèle de variables d'environnement
├── .env                      # Configuration locale
├── package.json              # Scripts racine (concurrently)
├── server/
│   ├── src/
│   │   ├── config.ts         # Validation & chargement configuration
│   │   ├── index.ts          # Serveur Express & BFF proxy
│   │   ├── db/
│   │   │   └── database.ts   # SQLite (better-sqlite3) & Cache
│   │   ├── services/
│   │   │   ├── churchtools.service.ts  # Client API ChurchTools
│   │   │   ├── kdrive.service.ts       # Client API kDrive v3 & throttle
│   │   │   └── tasks.service.ts        # Parseur & gestionnaire Taches_Comite.md
│   │   └── routes/
│   │       ├── auth.routes.ts          # Authentification de session
│   │       ├── meetings.routes.ts      # Séances, init kDrive, PV
│   │       ├── notes.routes.ts         # Notes ChurchTools
│   │       ├── files.routes.ts         # Fichiers kDrive & upload annexes
│   │       ├── tasks.routes.ts         # Tâches administratives
│   │       ├── churchtools.routes.ts   # Follow-ups & recherche personnes
│   │       └── status.routes.ts        # État des connexions
│   ├── data/                 # Répertoire de la base SQLite (data/app.db)
│   └── package.json
└── client/
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.tsx             # Navigation & indicateurs de statut
    │   │   ├── DashboardTab.tsx       # Vue d'ensemble & prochaine séance
    │   │   ├── PreparationTab.tsx     # Préparation séance & Ordre du Jour
    │   │   ├── MeetingSessionTab.tsx  # Séance en direct, PV & Annexes
    │   │   ├── TasksTab.tsx           # Tâches administratives (Kanban / Tableau)
    │   │   ├── FollowUpModal.tsx      # Modal suivi relationnel ChurchTools
    │   │   ├── PreparationModal.tsx   # Modal initialisation kDrive en 1 clic
    │   │   ├── AuthModal.tsx          # Déverrouillage si mot de passe actif
    │   │   └── Toast.tsx              # Notifications réactives & alertes 429
    │   ├── services/
    │   │   └── api.ts                 # Client API frontend
    │   ├── types/                     # Typages TypeScript partagés
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── index.css
    ├── vite.config.ts
    └── package.json
```

---

## ⚙️ Configuration (`.env`)

Copiez le fichier `.env.example` en `.env` à la racine :

```env
PORT=3000
NODE_ENV=development

# Protection d'accès (optionnelle - laissez vide pour accès libre sans mot de passe)
APP_PASSWORD=

# ChurchTools
CHURCHTOOLS_BASE_URL=https://mon-eglise.church.tools
CHURCHTOOLS_API_TOKEN=ct_token_xyz
CHURCHTOOLS_COMMITTEE_GROUP_ID=12

# Infomaniak kDrive (API REST v3)
KDRIVE_API_BASE_URL=https://api.infomaniak.com/3
KDRIVE_API_TOKEN=kdrive_token_xyz
KDRIVE_DRIVE_ID=123456
KDRIVE_ROOT_FOLDER_ID=789012  # ID du dossier racine "Comité / Séances"
```

---

## 🚀 Démarrage

### 1. Installation des dépendances
```bash
npm run install:all
```

### 2. Démarrage en mode Développement
Lance simultanément le backend Node.js (`http://localhost:3000`) et le frontend Vite (`http://localhost:5173`) :
```bash
npm run dev
```

### 3. Build & Démarrage en Production
```bash
npm run build
npm start
```
Le serveur Express sert automatiquement le bundle React compilé sur le port configuré (`http://localhost:3000`).

---

## 📋 Modules Fonctionnels Détaillés

### Module 1 : Vue d'ensemble & Prochaines Réunions
* Affiche la prochaine séance avec compte à rebours dynamique (*"Dans 5 jours"*, *"Aujourd'hui"*, etc.).
* Contrôle l'état du dossier sur kDrive (créé ou non, ODJ prêt, PV démarré).
* Action en un clic : **« Préparer la séance »**.

### Module 2 : Préparation de Séance & Points à l'Ordre du Jour
* Récupère les notes en attente du groupe comité ChurchTools (`GET /api/groups/{id}/notes`).
* Permet d'ajouter une note rapide depuis l'interface.
* Cases à cocher pour sélectionner les notes à injecter dans le futur Ordre du Jour.

### Module 3 : Gestion Documentaire & Cycle de Vie des Séances (kDrive)
* **Arborescence créée sur kDrive :**
  ```text
  /Comité_Séances/
  ├── Taches_Comite.md
  └── YYYY-MM-DD - Séance du Conseil/
      ├── YYYY-MM-DD_Ordre_du_Jour.md
      ├── YYYY-MM-DD_PV.md
      └── Annexes/ (PDFs, bilans...)
  ```
* **Bouton « Démarrer le PV » :** Clone automatiquement l'ODJ en `YYYY-MM-DD_PV.md`.
* **Éditeur Markdown :** Sauvegarde manuelle explicite pour éviter le rate-limiting d'Infomaniak.
* **Gestionnaire d'annexes :** Glisser-déposer de fichiers pour téléversement direct dans le dossier kDrive avec liens de consultation directe.

### Module 4 : Tableau de Bord des Tâches (`Taches_Comite.md`)
* Parseur tolérant pour la syntaxe standard :
  `- [ ] Intitulé de la tâche | @Assigné | YYYY-MM-DD | Réf: 2026-10-15`
* Indicateurs d'urgence :
  - 🔴 **Rouge :** En retard (`échéance < aujourd'hui`)
  - 🟠 **Orange :** Échéance dans moins de 7 jours
  - 🟢 **Vert :** Dans les temps
  - ⚪ **Gris :** Complétée
* Vues au choix : **Cartes** ou **Tableau**.
* Filtres dynamiques par statut, par responsable (`@Adrien`, `@Marc`...) et recherche textuelle.
* Écriture concurrente sécurisée (relecture immédiate de la version distante avant modification).

### Module 5 : Actions Relationnelles (Follow-ups ChurchTools)
* Modale d'action pastorale rapide avec autocomplétion des membres ChurchTools (`GET /api/persons`).
* Choix du responsable assigné, de la consigne et de la date d'échéance.
* Déclenchement natif du flux de suivi ChurchTools (`POST /api/followups`).
