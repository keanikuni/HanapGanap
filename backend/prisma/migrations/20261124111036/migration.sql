-- AlterTable
ALTER TABLE "students" ALTER COLUMN "qr_token" SET DEFAULT gen_random_uuid()::text;
