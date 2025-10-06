CREATE TABLE "post_engagements" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_url" varchar(1024) NOT NULL,
	"actor_name" varchar(255),
	"actor_profile_url" varchar(512) NOT NULL,
	"actor_urn" varchar(255),
	"type" varchar(20) NOT NULL,
	"reaction_type" varchar(30),
	"comment_text" text,
	"reacted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "post_eng_post_idx" ON "post_engagements" USING btree ("post_url");--> statement-breakpoint
CREATE INDEX "post_eng_actor_idx" ON "post_engagements" USING btree ("actor_profile_url");