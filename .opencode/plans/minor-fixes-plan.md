# Phase E — Corrections Mineures (M1-M9)

## M1. Tri pagination instable — `server/services/contactService.ts:319`

**Problème :** `ORDER BY "createdAt" DESC` sans clé secondaire. Deux contacts avec le même timestamp peuvent apparaître sur deux pages ou disparaître.

**Fix :** Ajouter `, "id" DESC` comme clé secondaire :
```sql
ORDER BY "createdAt" DESC, "id" DESC
```
Et la même chose pour la requête findMany à la ligne 329 :
```typescript
orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
```

**Fichier :** `server/services/contactService.ts` (lignes 319 et 329)

---

## M2. Dead code PDF — 4 fichiers

**Problème :** Le PDF a été retiré du controller mais des références subsistent dans les types et commentaires.

**Fix :**
1. `contactQuery.ts:3` : Retirer `'pdf'` du type `ExportFormat` → `'csv' | 'xlsx' | 'json'`
2. `contactService.ts:440` : Nettoyer le commentaire `"XLSX / PDF / JSON"` → `"XLSX / JSON"`
3. `exportRoutes.ts:14` : Retirer `'PDF'` du type cast → `'CSV' | 'XLSX' | 'JSON'`
4. `logService.ts:15,27` : Retirer `'PDF'` du type union et de la conversion LogFormat

**ATTENTION :** Le schema Prisma contient `LogFormat.PDF` dans l'enum. On ne touche PAS au schema (migration risquée). On retire juste les références TypeScript mortes. Le cast LogFormat restera compatible car Prisma génère toujours l'enum complet.

**Fichiers :** `src/utils/contactQuery.ts`, `server/services/contactService.ts`, `server/routes/exportRoutes.ts`, `server/services/logService.ts`

---

## M3. `/api/export/log` filtre IMPORT — `exportRoutes.ts:44`

**Problème perçu :** Le endpoint est dans `exportRoutes` mais filtre `LogType.IMPORT`.

**Résultat de l'analyse :** C'est CORRECT. L'outil chatbot `get_import_audit` appelle `GET /api/export/log` pour lister les imports. Le nom est juste trompeur. Ce n'est PAS un bug.

**Fix :** Renommer la route de `/log` vers `/import-log` et ajuster le chatbot tool `get_import_audit` pour appeler `/api/export/import-log`.

**Fichiers :** `server/routes/exportRoutes.ts`, `chatbot-service/app/services/tools.py` (ou équivalent)

---

## M4. Fallback Dashboard inexact — `DashboardView.tsx:210`

**Problème :** `const totalContacts = stats?.kpis.totalContacts ?? contacts.length;` — si l'API stats échoue, le fallback = la page courante (20 contacts), pas le total.

**Fix :** Afficher un indicateur visuel quand le fallback est actif. Ajouter un bandeau d'avertissement :
```tsx
const usingFallback = !stats;
// Dans le JSX :
{usingFallback && (
  <div className="bg-yellow-100 border-l-4 border-yellow-500 p-2 text-sm">
    Données partielles (stats serveur indisponibles)
  </div>
)}
```

**Fichier :** `src/components/DashboardView.tsx`

---

## M5. OCR auth cosmetique — `chatbot-service/app/routes/ocr_routes.py:72-82`

**Problème :** Le token est parsé mais jamais vérifié (pas de décodage JWT). N'importe quelle chaîne non-vide passe.

**Fix :** Ajouter la vérification JWT réelle avec PyJWT :
```python
import jwt as pyjwt
JWT_SECRET = os.getenv("JWT_SECRET", "arsii-crm-super-secret-jwt-key-2026")
# Après line 82 :
pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
```

**Fichier :** `chatbot-service/app/routes/ocr_routes.py`
**Dépendance :** Vérifier que `PyJWT` est dans `requirements.txt`. Si non, l'ajouter.

---

## M6. `Bearer null` si non connecté — `src/components/OcrImportTab.tsx:119`

**Problème :** `localStorage.getItem('euraxess_token')` retourne `null` → header `"Bearer null"` passe la validation syntaxique côté serveur (après M5, le JWT check échouera, mais le message d'erreur sera "Invalid token" au lieu de "Missing token").

**Fix :** Vérifier que le token existe avant de faire l'appel :
```tsx
const token = localStorage.getItem('euraxess_token');
if (!token) {
  setExtractionError("Vous devez être connecté pour utiliser l'OCR.");
  setIsExtracting(false);
  return;
}
```

**Fichier :** `src/components/OcrImportTab.tsx`

---

## M7. Erreur leakage OCR — `chatbot-service/app/routes/ocr_routes.py:126`

**Problème :** `detail=f"OCR extraction failed: {str(exc)}"` expose des détails internes (chemins fichiers, messages d'erreur).

**Fix :** Remplacer par un message générique :
```python
detail="Une erreur interne est survenue lors de l'extraction OCR.",
```
Le logger garde le détail complet (`logger.error` ligne 123).

**Fichier :** `chatbot-service/app/routes/ocr_routes.py`

---

## M8. Export XLSX/JSON en mémoire — `server/services/contactService.ts:441-447`

**Problème :** `collectExportRows()` materialise toutes les lignes en mémoire. Pour >10k contacts, consommation RAM élevée.

**Fix :** Pas de changement de code. Juste documenter la limite dans un commentaire JSDoc et ajouter un `console.warn` si >5000 rows :
```typescript
public async collectExportRows(params: ExportContactsParams): Promise<any[]> {
  const rows: any[] = [];
  for await (const contact of this.streamExport(params)) {
    rows.push(contact);
  }
  if (rows.length > 5000) {
    console.warn(`[Export] ${rows.length} rows materialized in memory. Consider CSV streaming for large exports.`);
  }
  return rows;
}
```

**Fichier :** `server/services/contactService.ts`

---

## M9. Console.log debug dans AuthView — DÉJÀ RÉSOLU

**Statut :** Les lignes 55, 60, 62, 65 ont été supprimées lors de la Phase D (correction D9). Plus rien à faire.

---

## Vérification
1. `npm run lint` (tsc --noEmit)
2. `npm run build`
3. `python -m pytest app/ocr/tests/ -v`
