# Phase D — Corrections Pre-Demo (B1-B5 + H1-H6)

## D1. CORS bug — `server/app.ts:37`
Line 37: `callback(null, true)` → `callback(null, false)`

## D2. `/api/export/data` — `server/routes/exportRoutes.ts:77`
Add `authenticateJWT` middleware. Import `AuthenticatedRequest`.

## D3. `/api/export/logs` — `server/routes/exportRoutes.ts:67`
Add `authenticateJWT` middleware.

## D4. `/api/dashboard/stats` — `server/routes/dashboardRoutes.ts:6`
Add `authenticateJWT` middleware. Import it.

## D5. Groq model — `chatbot-service/.env:8`
`GROQ_MODEL=openai/gpt-oss-120b` → `GROQ_MODEL=llama-3.3-70b-versatile`

## D6. Console.log token — `src/components/chat/ChatWidget.tsx:289,291`
Delete lines 289 and 291 (token logging).

## D7. JWT secret fallback — `server/middleware/authenticateJWT.ts:4`
Add `logger.warn` when using hardcoded fallback secret.

## D8. Token expired → 401 — `server/middleware/authenticateJWT.ts:39`
Change `res.status(403)` → `res.status(401)`.

## D9. AuthView console.log — `src/components/AuthView.tsx:55,60,62,65`
Remove all console.log/error lines that log token data.

## D10. N/A → null — `server/services/contactService.ts`
- Lines 592, 595 (createContact): `|| NA` → `|| null`
- Lines 714, 717 (bulkSave update): `|| NA` → `|| null`
- Remove `const NA = 'N/A';` (line 8) if no longer used.

## Verification
1. `npm run lint` (tsc --noEmit)
2. `npm run build`
3. `python -m pytest app/ocr/tests/ -v` (chatbot-service)
