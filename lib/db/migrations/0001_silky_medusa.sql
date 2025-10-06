CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(120),
	"last_name" varchar(120),
	"company" varchar(255),
	"title" varchar(255),
	"status" varchar(50) DEFAULT 'new' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"linkedin_url" varchar(512),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "leads_email_idx" ON "leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "leads_company_idx" ON "leads" USING btree ("company");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");