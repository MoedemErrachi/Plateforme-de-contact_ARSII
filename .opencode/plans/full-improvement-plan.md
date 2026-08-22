# Plan Complet — 8 Sections de Corrections (Final)

---

## Section 1: Data Import, ETL & Value Normalization

### Corrections

**1a. Backend — Pipeline de normalisation (`server/services/contactService.ts`)**
- Étendre `normalizeGender()` : mapper labels localisés ("homme"/"M"/"masculin" → `MALE`, "femme"/"F"/"feminin" → `FEMALE`)
- Créer `normalizeCountry(value)` : trim → alias (senegal/sénégal/SENEGAL → "Sénégal", etc.) → fallback `null` pour inconnu
- Modifier `clean()` : `""`, `"N/A"`, `"null"`, espaces-only → `null`
- Appliquer dans `createContact()`, `updateContact()`, `bulkSave()` (4 endroits)
- `splitFullName()` : `"N/A"` → `null`

**1b. Frontend — `formatNullValue()` (`src/utils/formatFieldValue.ts`)**
- Ajouter `formatNullValue(val)` → retourne `"N/A"` pour null/undefined/empty
- DistributionChart : remplacer `raw !== 'N/A' ? raw : 'Inconnu'` par le helper

**1c. OcrImportTab — Valeurs invalides**
- `'NONE' as Gender` → `'NOT_SPECIFIED' as Gender`
- `'R1' as ResearchCareerStage` → `'R1_FIRST_STAGE'`

### Fichiers
- `server/services/contactService.ts`
- `src/utils/formatFieldValue.ts`
- `src/components/OcrImportTab.tsx`
- `src/components/DistributionChart.tsx`

---

## Section 2: Auth — Proactive Token Expiry Interceptor

### Corrections

**2a. `src/utils/auth.ts` (nouveau)**
- `isTokenExpired(token)` : decode base64url, lire `exp`, comparer à `Date.now()/1000`
- `getTokenExpiry(token)` : retourne timestamp exp

**2b. `src/utils/api.ts` — Intercepteur**
- Avant chaque requête, vérifier `isTokenExpired(token)`
- Si expiré → ne PAS envoyer la requête, retourner erreur `AUTH_EXPIRED`

**2c. `src/App.tsx` — Logout complet**
- `handleLogout()` : appeler `POST /api/auth/logout` (clear cookie HttpOnly) AVANT de nettoyer le state
- useEffect restoration : vérifier `isTokenExpired()` AVANT `/api/auth/me`

**2d. `src/components/chat/ChatWidget.tsx`**
- Gérer l'erreur `AUTH_EXPIRED` proprement (message "Session expirée")

### Fichiers
- `src/utils/auth.ts` (nouveau)
- `src/utils/api.ts`
- `src/App.tsx`
- `src/components/chat/ChatWidget.tsx`

---

## Section 3: LLM Router — Health Tracking

### Corrections

**3a. `chatbot-service/app/providers/llm_router.py`**
- Ajouter `_provider_health` dict avec `consecutive_failures` et `last_failure_time`
- Si `consecutive_failures >= 3` et < 5 minutes → sauter le provider (log "provider dégradé")
- Reset `consecutive_failures` à 0 quand le provider réussit
- Le comportement actuel (singleton, fallback) est déjà correct — juste ajouter le health tracking

### Fichiers
- `chatbot-service/app/providers/llm_router.py`

---

## Section 4: Search Input UI Enhancements

### Corrections

**4a. `src/components/SearchInput.tsx` (nouveau)**
- Input avec icône Search + bouton X (quand value non vide)
- Dropdown historique (localStorage `euraxess_search_history`, max 10)
- Click outside → ferme dropdown

**4b. `src/utils/searchHistory.ts` (nouveau)**
- `getSearchHistory()`, `addSearch(query)`, `clearSearchHistory()`
- Storage: `localStorage('euraxess_search_history')`

**4c. `src/components/ContactsView.tsx`**
- Remplacer input brut par `<SearchInput>`
- Sauvegarder dans l'historique à chaque recherche appliquée

### Fichiers
- `src/components/SearchInput.tsx` (nouveau)
- `src/utils/searchHistory.ts` (nouveau)
- `src/components/ContactsView.tsx`

---

## Section 5: Chatbot Widget — Draggable & Dynamic Alignment

### Corrections

**5a. Bouton draggable (`ChatWidget.tsx`)**
- State `position: {x, y}` initialisé depuis `localStorage('euraxess_chat_position')` ou coin bottom-right
- `onPointerDown/Move/Up` pour le drag
- Au release : snap au coin le plus proche
- `fixed` avec `left/top` calculés

**5b. Panel dynamic alignment**
- Calculer le quadrant du bouton
- Panel : `bottom-full right-0` (bottom-right), `top-full right-0` (top-right), etc.
- Adapter l'animation scale selon le coin

### Fichiers
- `src/components/chat/ChatWidget.tsx`

---

## Section 6: Chatbot Column Rename + Contacts Table Sorting

### Corrections

**6a. Chatbot system prompt — Renommer colonne**
- `src/components/chat/ChatWidget.tsx` — pas de changement au rendu markdown
- `chatbot-service/app/prompts/system_prompt.py` : dans les exemples de tableaux, renommer la colonne "Voir le contact" en "Nom du contact" et ajouter une colonne "Actions" avec le lien

**6b. Backend — Tri de colonnes (`server/services/contactService.ts`)**
- Ajouter `sortBy` et `sortOrder` aux `QueryContactsParams`
- Whitelist : `createdAt`, `firstName`, `lastName`, `countryOfOrigin`, `affiliation`, `researchCareerStage`, `gender`
- SQL : `ORDER BY "${sortBy}" ${sortOrder}` (protégé par whitelist)

**6c. Validator (`server/validators/contactValidator.ts`)**
- Ajouter `sortBy` (enum whitelist) et `sortOrder` (`asc`/`desc`) au `queryContactSchema`

**6d. Frontend — Headers triables (`src/components/ContactsView.tsx`)**
- State `sortField` et `sortOrder`
- En-têtes cliquables avec ChevronUp/ChevronDown
- Params requête : `?sortBy=firstName&sortOrder=asc`

**6e. `src/utils/contactQuery.ts`**
- Ajouter sort params à `buildContactsListQuery()`

### Fichiers
- `chatbot-service/app/prompts/system_prompt.py`
- `server/services/contactService.ts`
- `server/validators/contactValidator.ts`
- `src/components/ContactsView.tsx`
- `src/utils/contactQuery.ts`

---

## Section 7: Dashboard Stats Loading Fix

### Corrections

**7a. `src/App.tsx`**
- Supprimer `setTimeout(() => setIsLoadingData(false), 300)`
- `setIsLoadingData(false)` uniquement quand les contacts sont chargés

**7b. `src/components/DashboardView.tsx`**
- Quand `stats === null` → afficher skeleton KPI (pas `0`)
- `h-8 w-16 bg-slate-200 rounded animate-pulse` pour chaque carte

### Fichiers
- `src/App.tsx`
- `src/components/DashboardView.tsx`

---

## Section 8: Security — CSV Injection Protection

### Corrections

**8a. `server/services/contactService.ts` — csvCell()**
- Préfixer les cellules commençant par `=`, `+`, `-`, `@`, `\t`, `\r` avec `'`
- Protège contre les formules Excel malveillantes

### Fichiers
- `server/services/contactService.ts`

### RBAC
Délibérément exclu — pas de RBAC pour l'instant.

---

## Ordre d'exécution

1. Section 8 (CSV injection) — sécurité, 1 fichier
2. Section 1 (ETL normalization) — fondation données
3. Section 7 (Dashboard loading) — UX quick fix
4. Section 2 (Token expiry) — sécurité auth
5. Section 3 (LLM Router health) — chatbot
6. Section 4 (Search UI) — composant nouveau
7. Section 6 (Sorting + chatbot prompt) — UX
8. Section 5 (Draggable widget) — UX isolé

## Vérification
- `npm run lint`
- `npm run build`
- `python -m pytest app/ocr/tests/ -v`
