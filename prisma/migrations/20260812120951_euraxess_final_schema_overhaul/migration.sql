-- AlterEnum
ALTER TYPE "Gender" ADD VALUE 'NOT_SPECIFIED';

-- DropForeignKey
ALTER TABLE "ExchangeNote" DROP CONSTRAINT "ExchangeNote_contactId_fkey";

-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "isVerified",
ALTER COLUMN "gender" SET DEFAULT 'NOT_SPECIFIED',
ALTER COLUMN "city" DROP NOT NULL,
ALTER COLUMN "phone" DROP NOT NULL,
ALTER COLUMN "phone" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Tag" DROP COLUMN "category",
ALTER COLUMN "color" DROP NOT NULL,
ALTER COLUMN "color" DROP DEFAULT;

-- DropTable
DROP TABLE "ExchangeNote";

-- DropEnum
DROP TYPE "NoteType";
