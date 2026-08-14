-- AlterEnum
BEGIN;
CREATE TYPE "Gender_new" AS ENUM ('FEMALE', 'MALE');
ALTER TABLE "Contact" ALTER COLUMN "gender" TYPE "Gender_new" USING ("gender"::text::"Gender_new");
ALTER TYPE "Gender" RENAME TO "Gender_old";
ALTER TYPE "Gender_new" RENAME TO "Gender";
DROP TYPE "public"."Gender_old";
COMMIT;
