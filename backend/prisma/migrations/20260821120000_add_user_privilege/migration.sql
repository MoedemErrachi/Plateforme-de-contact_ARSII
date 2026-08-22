-- Ajoute le modèle de privilèges à 3 niveaux pour les utilisateurs.
-- Les comptes existants conservent leurs capacités actuelles -> FULL_ACCESS.
CREATE TYPE "Privilege" AS ENUM ('READ', 'READ_WRITE', 'FULL_ACCESS');

ALTER TABLE "User" ADD COLUMN "privilege" "Privilege" NOT NULL DEFAULT 'FULL_ACCESS';
