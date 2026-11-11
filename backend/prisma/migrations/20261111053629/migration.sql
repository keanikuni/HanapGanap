/*
  Warnings:

  - You are about to drop the `certificate` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "certificate" DROP CONSTRAINT "certificate_registration_id_fkey";

-- DropTable
DROP TABLE "certificate";
