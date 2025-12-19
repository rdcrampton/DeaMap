-- AlterTable
ALTER TABLE "external_data_sources" ADD COLUMN "default_publication_mode" "PublicationMode" NOT NULL DEFAULT 'LOCATION_ONLY';
