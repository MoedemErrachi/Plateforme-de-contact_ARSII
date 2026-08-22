# ARSII CRM — Plateforme de gestion du réseau EURAXESS Afrique

Application web complète de gestion de contacts chercheurs : import OCR de cartes
de visite, segmentation dynamique, exports personnalisés et assistant conversationnel.

## Architecture

Le projet est un monorepo à trois services :

| Service | Stack | Port | Rôle |
|---|---|---|---|
| `backend/` | Node.js, Express, TypeScript, Prisma | 5000 | API REST, auth JWT (cookie HttpOnly), CSRF, RBAC, uploads Supabase Storage |
| `frontend/` | React 19, Vite, TypeScript, Tailwind CSS | 3000 | SPA (tableau de bord, contacts, segmentation, imports OCR, admin) |
| `chatbot-service/` | Python, FastAPI, httpx | 8000 | Assistant IA (Mistral/Groq/Gemini), extraction OCR des cartes de visite |

```
Navigateur ──▶ Frontend (Vite :3000)
                 ├── /api/*        ──proxy──▶ Backend Express (:5000) ──▶ PostgreSQL (Supabase)
                 └── /chatbot-api/*──proxy──▶ Chatbot FastAPI (:8000) ──▶ Backend (:5000)
```

Les proxys sont configurés dans `frontend/vite.config.ts` : le frontend appelle
uniquement des chemins relatifs (`/api/...`, `/chatbot-api/...`), ce qui évite
tout problème de CORS en développement.

## Prérequis

- **Node.js ≥ 20** (npm ≥ 10)
- **Python ≥ 3.11** (pour le chatbot-service uniquement)
- Une base **PostgreSQL** — le projet cible [Supabase](https://supabase.com)

## Démarrage rapide

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # puis renseigner les variables (voir ci-dessous)
npx prisma migrate deploy   # ou: npx prisma migrate dev
npm run db:seed             # crée les comptes admin + démo
npm run dev                 # démarre sur http://localhost:5000
```

Comptes créés par le seed (mots de passe définis via `SEED_ADMIN_PASSWORD`
et `SEED_DEMO_PASSWORD`) :

- Administrateur : `admin@arsii.org`
- Utilisateurs démo : `demo@arsii.org`, `marie@arsii.org`

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env        # ports et URLs des services
npm run dev                 # démarre sur http://localhost:3000
```

### 3. Chatbot (optionnel — requis pour l'assistant et l'OCR)

```bash
cd chatbot-service
python -m venv .venv
.\.venv\Scripts\activate        # Windows (source .venv/bin/activate sous Linux/macOS)
pip install -r requirements.txt
cp .env.example .env            # clés API LLM obligatoires
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Au moins une clé parmi `MISTRAL_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`
est nécessaire ; les trois fournisseurs servent de fallback mutuel.

## Variables d'environnement

### `backend/.env`

| Variable | Description |
|---|---|
| `DATABASE_URL` | Connexion Prisma au runtime (Supabase : pooler Supavisor port 5432 en prod, sans `pgbouncer=true`) |
| `DIRECT_URL` | Connexion directe utilisée par le CLI Prisma (migrations, introspection) |
| `SHADOW_DATABASE_URL` | Base shadow pour `prisma migrate dev` (vide en local) |
| `SUPABASE_URL` | URL du projet Supabase (uploads Storage) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé **admin** Supabase — backend uniquement, jamais côté client |
| `JWT_SECRET` | Secret de signature des JWT (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `CSRF_SECRET` | Clé HMAC des tokens CSRF — **obligatoire en production** |
| `HOST` / `PORT` | Écoute du serveur (`0.0.0.0` / `5000`) |
| `NODE_ENV` | `development` par défaut ; en `production`, la validation CSRF devient active |
| `FRONTEND_URL` | URL du frontend (liens de réinitialisation de mot de passe) |
| `CORS_ORIGINS` | Origines autorisées, séparées par des virgules, sans joker |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | SMTP Gmail pour les e-mails transactionnels (mot de passe d'application) |
| `SEED_ADMIN_PASSWORD` / `SEED_DEMO_PASSWORD` | Mots de passe du seed |

### `frontend/.env`

| Variable | Description |
|---|---|
| `PORT` | Port du serveur Vite (3000) |
| `VITE_BACKEND_URL` | Cible du proxy `/api` en développement (`http://localhost:5000`) |
| `VITE_CHATBOT_API_URL` | Cible du proxy `/chatbot-api` (`http://localhost:8000`) |

### `chatbot-service/.env`

| Variable | Description |
|---|---|
| `HOST` / `PORT` | Écoute du service (`0.0.0.0` / `8000`) |
| `MAIN_API_BASE_URL` | URL de l'API backend (`http://localhost:5000`) |
| `JWT_SECRET` | **Identique** à celui du backend (le chatbot valide les tokens entrants) |
| `MISTRAL_API_KEY` / `GROQ_API_KEY` / `GEMINI_API_KEY` | Clés des fournisseurs LLM (fallback mutuel) |
| `MISTRAL_MODEL` / `GROQ_MODEL` / `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL` | Modèles utilisés |
| `SESSION_TTL_SECONDS` / `SESSION_MAX_MESSAGES` | Durée de vie et taille des sessions de chat |
| `CHATBOT_RATE_LIMIT` | Limite de débit (ex. `20/minute`) |
| `MAX_TOOL_ROUNDS` | Nombre max d'appels d'outils par message |
| `FRONTEND_ORIGINS` | Origines CORS autorisées, sans joker |

## Scripts utiles

### Backend (`cd backend`)

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement (tsx watch) |
| `npm run build` / `npm start` | Build production puis exécution |
| `npm run lint` | ESLint |
| `npm run test:db` | Diagnostic base de données (7 vérifications : connexion, schéma, tables, seed…) |
| `npx prisma migrate dev` | Applique les migrations en développement |
| `npm run db:seed` | Réinitialise et peuple la base |

### Frontend (`cd frontend`)

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur Vite avec proxys `/api` et `/chatbot-api` |
| `npm run build` | Build de production (`dist/`) |
| `npm run lint` | ESLint |
| `npm run preview` | Sert le build de production localement |

### Santé des services

- Backend : `GET http://localhost:5000/api/health` → `{ status: 'ok', database: 'connected', … }`
- Chatbot : `GET http://localhost:8000/health`

## Sécurité

- **Authentification** : JWT signé HS256, transporté à la fois en cookie
  `HttpOnly` (SameSite=Lax, expiration 8 h, ou 7 jours si « Se souvenir de moi »)
  et en token Bearer côté client.
- **RBAC** : rôle `admin` requis pour `/api/users/*` (middleware `requireAdmin`)
  et pour la route front `/admin` (garde `RequireAdmin`).
- **CSRF** : double-submit cookie signé HMAC, actif dès que `NODE_ENV=production`.
- **Rate limiting** : endpoints sensibles protégés (`slowapi` côté chatbot).
- Aucune clé secrète ne doit être commitée ; `.env` est ignoré par git.

### Rotation des secrets avant mise en production

À exécuter une fois, avant le premier déploiement public :

1. **Mot de passe base de données** (le mot de passe actuel est faible et a
   circulé hors `.env`) — Dashboard Supabase → *Settings → Database → Reset
   database password*, ou SQL :
   ```sql
   ALTER ROLE postgres PASSWORD '<NOUVEAU_MOT_DE_PASSE>';
   ```
   Puis mettre à jour `DATABASE_URL` et `DIRECT_URL` dans `backend/.env`.
2. **Clé `service_role` Supabase** — Dashboard Supabase → *Settings → API →
   Regenerate service_role key*. Mettre à jour `SUPABASE_SERVICE_ROLE_KEY`
   (backend uniquement).
3. **Secrets applicatifs** (`backend/.env` + identique dans
   `chatbot-service/.env` pour `JWT_SECRET`) :
   ```bash
   node -e "const c=require('crypto');console.log('JWT_SECRET='+c.randomBytes(48).toString('hex'));console.log('CSRF_SECRET='+c.randomBytes(48).toString('hex'))"
   ```
4. **Mot de passe d'application Gmail** — révoquer l'ancien
   (*Compte Google → Sécurité → Mots de passe d'app*) et en générer un neuf.
5. Vérifier ensuite : `npm run test:db`, puis `GET /api/health`.

### Déploiement production

```bash
# Backend
cd backend && npm ci && npx prisma migrate deploy && npm run build && npm start

# Frontend (dist/ servi derrière un reverse proxy routant /api et /chatbot-api)
cd frontend && npm ci && npm run build

# Chatbot service
cd chatbot-service && pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port 8000
```

Variables obligatoires en production : `NODE_ENV=production`,
`DATABASE_URL` (pooler transaction **6543**, `pgbouncer=true`),
`DIRECT_URL` (hôte direct 5432), `JWT_SECRET`, `CSRF_SECRET`, `CORS_ORIGINS`,
`FRONTEND_ORIGINS` (chatbot), clés Supabase. En production le backend active
automatiquement la validation CSRF et la Content-Security-Policy.

## Dépannage

| Symptôme | Cause probable / solution |
|---|---|
| `P1001: Can't reach database server` | `DATABASE_URL` incorrecte ou IP non autorisée ; vérifier aussi IPv6 (préférer le pooler Supavisor) |
| Le login échoue avec `401` | Comptes absents → relancer `npm run db:seed` après `migrate deploy` |
| CORS bloqué en dev | `CORS_ORIGINS` (backend) doit contenir `http://localhost:3000` |
| L'extraction OCR renvoie « Service injoignable » | Le chatbot-service n'est pas lancé sur le port 8000 (ou `VITE_CHATBOT_API_URL` erronée) |
| Le chatbot répond `401` | `JWT_SECRET` différent entre backend et chatbot-service |
| E-mails non envoyés | Mot de passe d'application Gmail requis (2FA activée), pas le mot de passe du compte |
