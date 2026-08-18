CREATE TABLE "app_metadata" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
