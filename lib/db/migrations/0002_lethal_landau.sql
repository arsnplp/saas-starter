CREATE TABLE "icp_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"industries" text,
	"locations" text,
	"buyer_roles" text,
	"keywords_include" text,
	"keywords_exclude" text,
	"company_size_min" integer DEFAULT 1 NOT NULL,
	"company_size_max" integer DEFAULT 10000 NOT NULL,
	"product_category" varchar(100),
	"language" varchar(10) DEFAULT 'fr' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
