-- Add robot software download fields to Product
ALTER TABLE "Product" ADD COLUMN "downloadUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN "downloadFileName" TEXT;
ALTER TABLE "Product" ADD COLUMN "downloadVersion" TEXT;

