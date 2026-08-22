-- Index de performance pour les requêtes fréquentes de l'application.

-- Lookup des jetons de réinitialisation actifs d'un utilisateur.
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- Filtres serveur par pays (annuaire, segments, exports).
CREATE INDEX "Contact_countryOfOrigin_idx" ON "Contact"("countryOfOrigin");

-- Sens inverse du PK composite : contacts d'un tag donné.
CREATE INDEX "TagOnContact_tagId_idx" ON "TagOnContact"("tagId");

-- Segments par propriétaire.
CREATE INDEX "Segment_userId_idx" ON "Segment"("userId");

-- Historique import/export par utilisateur, du plus récent au plus ancien.
CREATE INDEX "ImportExportLog_userId_createdAt_idx" ON "ImportExportLog"("userId", "createdAt");
