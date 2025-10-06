import {
    pgTable,
    serial,
    varchar,
    text,
    timestamp,
    integer,
    uuid,
    index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: varchar('role', { length: 20 }).notNull().default('member'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
});

export const teams = pgTable('teams', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    stripeCustomerId: text('stripe_customer_id').unique(),
    stripeSubscriptionId: text('stripe_subscription_id').unique(),
    stripeProductId: text('stripe_product_id'),
    planName: varchar('plan_name', { length: 50 }),
    subscriptionStatus: varchar('subscription_status', { length: 20 }),
});

export const teamMembers = pgTable('team_members', {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
        .notNull()
        .references(() => users.id),
    teamId: integer('team_id')
        .notNull()
        .references(() => teams.id),
    role: varchar('role', { length: 50 }).notNull(),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
        .notNull()
        .references(() => teams.id),
    userId: integer('user_id').references(() => users.id),
    action: text('action').notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
        .notNull()
        .references(() => teams.id),
    email: varchar('email', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull(),
    invitedBy: integer('invited_by')
        .notNull()
        .references(() => users.id),
    invitedAt: timestamp('invited_at').notNull().defaultNow(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
});

export const teamsRelations = relations(teams, ({ many }) => ({
    teamMembers: many(teamMembers),
    activityLogs: many(activityLogs),
    invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ many }) => ({
    teamMembers: many(teamMembers),
    invitationsSent: many(invitations),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
    team: one(teams, {
        fields: [invitations.teamId],
        references: [teams.id],
    }),
    invitedBy: one(users, {
        fields: [invitations.invitedBy],
        references: [users.id],
    }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
    user: one(users, {
        fields: [teamMembers.userId],
        references: [users.id],
    }),
    team: one(teams, {
        fields: [teamMembers.teamId],
        references: [teams.id],
    }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
    team: one(teams, {
        fields: [activityLogs.teamId],
        references: [teams.id],
    }),
    user: one(users, {
        fields: [activityLogs.userId],
        references: [users.id],
    }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type TeamDataWithMembers = Team & {
    teamMembers: (TeamMember & {
        user: Pick<User, 'id' | 'name' | 'email'>;
    })[];
};

export enum ActivityType {
    SIGN_UP = 'SIGN_UP',
    SIGN_IN = 'SIGN_IN',
    SIGN_OUT = 'SIGN_OUT',
    UPDATE_PASSWORD = 'UPDATE_PASSWORD',
    DELETE_ACCOUNT = 'DELETE_ACCOUNT',
    UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
    CREATE_TEAM = 'CREATE_TEAM',
    REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
    INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
    ACCEPT_INVITATION = 'ACCEPT_INVITATION',
}

// ---------- LEADS TABLE ----------
export const leads = pgTable(
    'leads',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        email: varchar('email', { length: 255 }),
        firstName: varchar('first_name', { length: 120 }),
        lastName: varchar('last_name', { length: 120 }),
        company: varchar('company', { length: 255 }),
        title: varchar('title', { length: 255 }),
        status: varchar('status', { length: 50 }).notNull().default('new'), // new | contacted | replied | qualified | lost
        score: integer('score').notNull().default(0),
        linkedinUrl: varchar('linkedin_url', { length: 512 }),
        notes: text('notes'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (t) => ({
        emailIdx: index('leads_email_idx').on(t.email),
        companyIdx: index('leads_company_idx').on(t.company),
        statusIdx: index('leads_status_idx').on(t.status),
    })

);
// ---------- POST ENGAGEMENTS ----------
export const postEngagements = pgTable(
    "post_engagements",
    {
        id: serial("id").primaryKey(),
        postUrl: varchar("post_url", { length: 1024 }).notNull(),

        actorName: varchar("actor_name", { length: 255 }),
        actorProfileUrl: varchar("actor_profile_url", { length: 512 }).notNull(),
        actorUrn: varchar("actor_urn", { length: 255 }),

        type: varchar("type", { length: 20 }).notNull(), // "REACTION" | "COMMENT"
        reactionType: varchar("reaction_type", { length: 30 }), // LIKE/PRAISE/...
        commentText: text("comment_text"),

        reactedAt: timestamp("reacted_at"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (t) => ({
        postIdx: index("post_eng_post_idx").on(t.postUrl),
        actorIdx: index("post_eng_actor_idx").on(t.actorProfileUrl),
    })
);


// ---------- ICP PROFILES ----------
export const icpProfiles = pgTable('icp_profiles', {
    id: serial('id').primaryKey(),
    // Listes sous forme de texte séparé par des virgules (simple pour démarrer)
    industries: text('industries'),                // ex: "SaaS,e-commerce"
    locations: text('locations'),                  // ex: "France,Belgium,Remote"
    buyerRoles: text('buyer_roles'),               // ex: "CMO,Head of Marketing,Growth Lead"
    keywordsInclude: text('keywords_include'),     // ex: "SEO,lead gen"
    keywordsExclude: text('keywords_exclude'),     // ex: "B2C only,agencies"

    // Taille d'entreprise
    companySizeMin: integer('company_size_min').notNull().default(1),
    companySizeMax: integer('company_size_max').notNull().default(10000),

    // Catégorie produit + langue
    productCategory: varchar('product_category', { length: 100 }),
    language: varchar('language', { length: 10 }).notNull().default('fr'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
