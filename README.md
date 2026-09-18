# ARSII CRM — Plateforme de gestion du réseau EURAXESS Africa

Application web complète de gestion de contacts chercheurs : import OCR de cartes
de visite, segmentation dynamique, exports personnalisés et assistant conversationnel.

## Architecture

Monorepo à trois services :

| Service | Stack | Port | Rôle |
|---|---|---|---|
| `backend/` | Node.js, Express, TypeScript, Prisma 7 (driver adapter), Supabase Storage | 5000 | API REST, auth JWT (cookie HttpOnly), CSRF, RBAC, e-mails, uploads |
| `frontend/` | React 19, Vite, TypeScript, Tailwind CSS | 3000 | SPA (tableau de bord, contacts, segmentation, imports OCR, admin) |
| `chatbot-service/` | Python, FastAPI, httpx | 8000 | Assistant IA (Mistral/Groq/Gemini), extraction OCR des cartes de visite |

```
Navigateur ──▶ Frontend (/)
                  ├── /api/*        ──▶ Backend Express   ──▶ PostgreSQL (Supabase)
                  └── /chatbot-api/*──▶ Chatbot FastAPI   ──▶ Backend (outils)
```

Le frontend n'appelle que des chemins relatifs (`/api/...`, `/chatbot-api/...`) :
en développement ces routes sont proxées par `frontend/vite.config.ts`, en
production par `frontend/vercel.json` (destinations `$BACKEND_URL` /
`$CHATBOT_URL`, voir [Déploiement](#déploiement-production)). Cette même-origine
conserve les cookies d'authentification et la protection CSRF.

## Prérequis

- **Node.js ≥ 20** (npm ≥ 10)
- **Python ≥ 3.11** (chatbot-service uniquement)
- Une base **PostgreSQL** — le projet cible [Supabase](https://supabase.com)
- **Tesseract OCR** pour l'extraction locale (installé automatiquement dans l'image Docker de production)

## Démarrage rapide

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # renseigner les variables (voir ci-dessous)
npx prisma migrate dev      # applique les migrations + génère le client
npm run seed                # crée comptes, tags, ~125 contacts et segments (idempotent)
npm run dev                 # http://localhost:5000
```

Comptes créés par le seed (mots de passe via `SEED_ADMIN_PASSWORD` /
`SEED_DEMO_PASSWORD`) :

- Administrateurs : `admin@arsii.org`, `maalel.ahmed@gmail.com`
- Utilisateur démo : `demo@arsii.org`

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev                 # http://localhost:3000
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

> `.env` est ignoré par git. `.env.example` est la **source de vérité** : aucune
> URL de déploiement n'est commitée dans le dépôt.

### `backend/.env`

| Variable | Description |
|---|---|
| `DATABASE_URL` | **Runtime** (API) : pooler transaction Supavisor, port **6543**, `pgbouncer=true` — consommée via le driver adapter Prisma |
| `DIRECT_URL` | **CLI Prisma** (migrations, introspection) : connexion directe, port **5432** (`prisma.config.ts`) |
| `SHADOW_DATABASE_URL` | Base shadow pour `prisma migrate dev` (vide si superuser local) |
| `SUPABASE_URL` | URL du projet Supabase (uploads Storage) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé **admin** Supabase — backend uniquement, jamais côté client |
| `JWT_SECRET` | Secret de signature des JWT (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `CSRF_SECRET` | Clé HMAC des tokens CSRF — **obligatoire en production** |
| `HOST` / `PORT` | Écoute du serveur (`0.0.0.0` / `5000`) |
| `NODE_ENV` | `development` par défaut ; en `production`, la validation CSRF devient active |
| `FRONTEND_URL` | URL du frontend (liens de réinitialisation de mot de passe) |
| `CORS_ORIGINS` | Origines autorisées, séparées par des virgules, sans joker |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | SMTP Gmail pour les e-mails transactionnels (mot de passe d'application) |
| `SEED_ADMIN_PASSWORD` / `SEED_DEMO_PASSWORD` | Mots de passe du seed (`npm run seed`) — **obligatoires pour lancer le seed** |

En `production`, `FRONTEND_URL` et `CORS_ORIGINS` sont **obligatoires** : le
backend refuse de démarrer sans elles (validation au boot) plutôt que de retomber
silencieusement sur `http://localhost:3000`.

### `frontend/.env`

| Variable | Description |
|---|---|
| `PORT` | Port du serveur Vite (3000) |
| `VITE_BACKEND_URL` | Cible du proxy `/api` en développement (`http://localhost:5000`) |
| `VITE_CHATBOT_API_URL` | Cible du proxy `/chatbot-api` (`http://localhost:8000`) |
| `DISABLE_HMR` | Dev uniquement, optionnel : `true` coupe le hot-reload (serveur CI) |

### `chatbot-service/.env`

| Variable | Description |
|---|---|
| `HOST` / `PORT` | Écoute du service (`0.0.0.0` / `8000`) |
| `MAIN_API_BASE_URL` | URL de l'API backend (outils du chatbot) |
| `JWT_SECRET` | **Identique** à celui du backend (le chatbot valide les tokens entrants) |
| `MISTRAL_API_KEY` / `GROQ_API_KEY` / `GEMINI_API_KEY` | Clés des fournisseurs LLM (fallback mutuel) |
| `MISTRAL_MODEL` / `GROQ_MODEL` / `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL` | Modèles utilisés |
| `SESSION_TTL_SECONDS` / `SESSION_MAX_MESSAGES` | Durée de vie et taille des sessions de chat |
| `CHATBOT_RATE_LIMIT` | Limite de débit du chat (ex. `20/minute`) |
| `OCR_RATE_LIMIT` | Limite de débit de l'endpoint OCR (défaut `10/minute`) |
| `MAX_TOOL_ROUNDS` | Nombre max d'appels d'outils par message |
| `FRONTEND_ORIGINS` | Origines CORS autorisées, sans joker |

## Scripts utiles

### Backend (`cd backend`)

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement (`tsx watch`) |
| `npm run build` / `npm start` | Build production (`esbuild` → `dist/server.cjs`) puis exécution |
| `npm run lint` | Typecheck TypeScript (`tsc --noEmit`) |
| `npm run test` / `npm run test:coverage` | Tests (Vitest) avec couverture |
| `npm run seed` | Seed idempotent (comptes, tags, contacts, segments) |
| `npm run test:db` | Diagnostic base de données (7 vérifications : connexion, schéma, tables, seed…) |
| `npm run fix:countries` / `npm run fix:countries:dry` | Normalisation des noms de pays (avec simulation) |
| `npx prisma migrate dev` / `npx prisma migrate deploy` | Migrations (développement / production) |

### Frontend (`cd frontend`)

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur Vite avec proxys `/api` et `/chatbot-api` |
| `npm run build` | Build de production (`dist/`) |
| `npm run lint` | Typecheck TypeScript (`tsc --noEmit`) |
| `npm run preview` | Sert le build de production localement |
| `npm run test` / `npm run test:coverage` | Tests (Vitest + Testing Library) avec couverture |

### Santé des services

- Backend : `GET http://localhost:5000/api/health`
- Chatbot : `GET http://localhost:8000/health`

## Tests

Trois suites indépendantes, couvertures ≥ 90 % (ligne) pour le frontend :

```bash
# Backend (Vitest)
cd backend && npm run lint && npm run test:coverage

# Frontend (Vitest + Testing Library)
cd frontend && npm run lint && npm run test:coverage

# Chatbot (pytest)
cd chatbot-service && python -m pytest
```

Une analyse SonarCloud (codesmells, duplications, couverture, sécurité) est
exécutée sur chaque push vers `testing` et `main` (`.github/workflows/sonarcloud.yml`).

## Sécurité

- **Authentification** : JWT signé HS256, transporté à la fois en cookie
  `HttpOnly` (SameSite=Lax, expiration 8 h, ou 7 jours si « Se souvenir de moi »)
  et en token Bearer côté client.
- **RBAC** : rôle `admin` requis pour `/api/users/*` (middleware `requireAdmin`)
  et pour la route front `/admin` (garde `RequireAdmin`).
- **CSRF** : double-submit cookie signé HMAC, actif dès que `NODE_ENV=production`.
- **Head of line** : en-têtes de sécurité via helmet, rate limiting sur les
  endpoints sensibles (`express-rate-limit`) et côté chatbot (`slowapi`).
- Aucune clé secrète ni URL de déploiement ne doit être commitée ; `.env` est
  ignoré par git, `.env.example` est la seule référence.

### Rotation des secrets avant mise en production

À exécuter une fois, avant le premier déploiement public :

1. **Mot de passe base de données** (s'il a circulé hors `.env`) — Dashboard
   Supabase → *Settings → Database → Reset database password*, ou SQL :
   ```sql
   ALTER ROLE postgres PASSWORD '<NOUVEAU_MOT_DE_PASSE>';
   ```
   Puis mettre à jour `DATABASE_URL` et `DIRECT_URL`.
2. **Clé `service_role` Supabase** — Dashboard Supabase → *Settings → API →
   Regenerate service_role key*. Mettre à jour `SUPABASE_SERVICE_ROLE_KEY`
   (backend uniquement).
3. **Secrets applicatifs** (`JWT_SECRET` identique backend/chatbot) :
   ```bash
   node -e "const c=require('crypto');console.log('JWT_SECRET='+c.randomBytes(48).toString('hex'));console.log('CSRF_SECRET='+c.randomBytes(48).toString('hex'))"
   ```
4. **Mot de passe d'application Gmail** — révoquer l'ancien
   (*Compte Google → Sécurité → Mots de passe d'app*) et en générer un neuf.
5. Vérifier ensuite : `npm run test:db`, puis `GET /api/health`.

## Déploiement production

Trois plateformes : **Supabase** (base + storage), **Render** (backend + chatbot),
**Vercel** (frontend). Le format de déploiement est décrit par `backend/render.yaml`
et `chatbot-service/render.yaml` (blueprints Render) et `frontend/vercel.json`.

### 1. Supabase

Créer un projet, récupérer dans *Project Settings → Database* :

- `DATABASE_URL` — pooler transaction, port **6543**, avec `pgbouncer=true`
- `DIRECT_URL` — connexion directe, port **5432** (`sslmode=require`)
- `SUPABASE_SERVICE_ROLE_KEY` et `SUPABASE_URL` (*Project Settings → API*)

Créer le bucket de stockage et ses politiques, puis appliquer les migrations
depuis une machine autorisée :

```bash
cd backend && npm ci && npx prisma migrate deploy && npm run seed
```

### 2. Backend (Render — blueprint `backend/render.yaml`)

Le blueprint définit : runtime Node, build (`prisma generate` + build +
`prisma migrate deploy`), commande `npm start`, santé `GET /api/health`.

Variables classées `sync: false` **à renseigner dans le tableau de bord Render**
(elles contiennent des secrets ou des URLs d'environnement) :

- `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`
- **`FRONTEND_URL`** et **`CORS_ORIGINS`** (par ex. `https://<frontend>.vercel.app`)

`JWT_SECRET` et `CSRF_SECRET` sont générés automatiquement par le blueprint.
**Sans `FRONTEND_URL` et `CORS_ORIGINS`, le backend refuse de démarrer.**

### 3. Chatbot (Render — blueprint `chatbot-service/render.yaml`, Docker)

`sync: false` **à renseigner dans le tableau de bord Render** :

- `MAIN_API_BASE_URL` (par ex. `https://<backend>.onrender.com`)
- `FRONTEND_ORIGINS` (par ex. `https://<frontend>.vercel.app`)
- `JWT_SECRET` — **doit être identique** à celui du backend
- `MISTRAL_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`

Santé : `GET /health`. `MISTRAL_MODEL`, `GROQ_MODEL`, `GEMINI_MODEL`, sessions,
limites de débit (`CHATBOT_RATE_LIMIT`, `OCR_RATE_LIMIT`) et `MAX_TOOL_ROUNDS`
sont déjà renseignés par le blueprint.

### 4. Frontend (Vercel)

Importer le dépôt (framework Vite, build `npm run build`, output `dist/`), puis
définir deux **variables de projet** (pas `.env`, pas commitées) :

| Variable | Valeur |
|---|---|
| `BACKEND_URL` | `https://<backend>.onrender.com` |
| `CHATBOT_URL` | `https://<chatbot>.onrender.com` |

`vercel.json` route `/api/*` et `/chatbot-api/*` vers ces variables (`$BACKEND_URL`,
`$CHATBOT_URL`) et sert la SPA (fallback `/index.html`, cache immuable des assets
hashed). L'authentification et le CSRF restent same-origin.

### 5. Validation post-déploiement

Configuration production obligatoire : `NODE_ENV=production`, `DATABASE_URL`
(pooler 6543, `pgbouncer=true`), `DIRECT_URL` (5432), `JWT_SECRET`, `CSRF_SECRET`,
`FRONTEND_URL`, `CORS_ORIGINS` (backend) ; `MAIN_API_BASE_URL`, `JWT_SECRET`,
`FRONTEND_ORIGINS` (chatbot) ; `BACKEND_URL`, `CHATBOT_URL` (frontend/Vercel).

Smoke test :

```bash
curl https://<backend>.onrender.com/api/health
curl https://<chatbot>.onrender.com/health
```

puis : connexion admin, invitation d'un utilisateur (e-mail Gmail reçu), import OCR
d'une carte, export personnalisé. Les analyses SonarCloud de la branche `main`
doivent rester vertes (0 issue ouverte, qualité de code ok).

## Dépannage

| Symptôme | Cause probable / solution |
|---|---|
| `P1001: Can't reach database server` | `DATABASE_URL` incorrecte ou IP non autorisée ; préférer le pooler Supavisor (6543) |
| Le login échoue avec `401` | Comptes absents → relancer `npm run seed` après `migrate deploy` |
| CORS bloqué | `CORS_ORIGINS` (backend) et `FRONTEND_ORIGINS` (chatbot) doivent contenir l'origine du frontend |
| Backend : « Configuration production incomplète » | `FRONTEND_URL` / `CORS_ORIGINS` absents alors que `NODE_ENV=production` |
| L'extraction OCR renvoie « Service injoignable » | Le chatbot-service n'est pas lancé (5000/8000) ou `VITE_CHATBOT_API_URL` erronée |
| Le chatbot répond `401` | `JWT_SECRET` différent entre backend et chatbot-service |
| E-mails non envoyés | Mot de passe d'application Gmail requis (2FA activée), pas le mot de passe du compte |