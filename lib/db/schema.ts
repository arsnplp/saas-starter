import {
    pgTable,
    serial,
    varchar,
    text,
    timestamp,
    integer,
    uuid,
    index,
    boolean,
    jsonb,
    unique,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

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

export const linkedinConnections = pgTable('linkedin_connections', {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
        .notNull()
        .references(() => teams.id)
        .unique(),
    loginToken: text('login_token').notNull(),
    linkedinEmail: varchar('linkedin_email', { length: 255 }),
    connectedBy: integer('connected_by')
        .notNull()
        .references(() => users.id),
    connectedAt: timestamp('connected_at').notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at'),
    isActive: boolean('is_active').notNull().default(true),
});

export const linkedinOAuthCredentials = pgTable('linkedin_oauth_credentials', {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
        .notNull()
        .references(() => teams.id)
        .unique(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at').notNull(),
    scope: text('scope').notNull(),
    tokenType: varchar('token_type', { length: 50 }).default('Bearer'),
    linkedinMemberUrn: varchar('linkedin_member_urn', { length: 255 }),
    connectedBy: integer('connected_by')
        .notNull()
        .references(() => users.id),
    connectedAt: timestamp('connected_at').notNull().defaultNow(),
    lastRefreshedAt: timestamp('last_refreshed_at'),
    isActive: boolean('is_active').notNull().default(true),
});

export const gmailConnections = pgTable('gmail_connections', {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
        .notNull()
        .references(() => teams.id)
        .unique(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at').notNull(),
    scope: text('scope').notNull(),
    tokenType: varchar('token_type', { length: 50 }).default('Bearer'),
    googleEmail: varchar('google_email', { length: 255 }),
    connectedBy: integer('connected_by')
        .notNull()
        .references(() => users.id),
    connectedAt: timestamp('connected_at').notNull().defaultNow(),
    lastRefreshedAt: timestamp('last_refreshed_at'),
    isActive: boolean('is_active').notNull().default(true),
});

export const oauthStates = pgTable('oauth_states', {
    id: serial('id').primaryKey(),
    state: varchar('state', { length: 255 }).notNull().unique(),
    teamId: integer('team_id')
        .notNull()
        .references(() => teams.id),
    userId: integer('user_id')
        .notNull()
        .references(() => users.id),
    provider: varchar('provider', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at').notNull(),
    used: boolean('used').notNull().default(false),
});

export const oauthFailureLogs = pgTable('oauth_failure_logs', {
    id: serial('id').primaryKey(),
    provider: varchar('provider', { length: 50 }).notNull(),
    failureType: varchar('failure_type', { length: 100 }).notNull(),
    state: varchar('state', { length: 255 }),
    userId: integer('user_id').references(() => users.id),
    teamId: integer('team_id').references(() => teams.id),
    errorMessage: text('error_message'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const linkedinConnectionsRelations = relations(linkedinConnections, ({ one }) => ({
    team: one(teams, {
        fields: [linkedinConnections.teamId],
        references: [teams.id],
    }),
    connectedByUser: one(users, {
        fields: [linkedinConnections.connectedBy],
        references: [users.id],
    }),
}));

export const linkedinOAuthCredentialsRelations = relations(linkedinOAuthCredentials, ({ one }) => ({
    team: one(teams, {
        fields: [linkedinOAuthCredentials.teamId],
        references: [teams.id],
    }),
    connectedByUser: one(users, {
        fields: [linkedinOAuthCredentials.connectedBy],
        references: [users.id],
    }),
}));

export const gmailConnectionsRelations = relations(gmailConnections, ({ one }) => ({
    team: one(teams, {
        fields: [gmailConnections.teamId],
        references: [teams.id],
    }),
    connectedByUser: one(users, {
        fields: [gmailConnections.connectedBy],
        references: [users.id],
    }),
}));

export const oauthStatesRelations = relations(oauthStates, ({ one }) => ({
    team: one(teams, {
        fields: [oauthStates.teamId],
        references: [teams.id],
    }),
    user: one(users, {
        fields: [oauthStates.userId],
        references: [users.id],
    }),
}));

export const teamsRelations = relations(teams, ({ many, one }) => ({
    teamMembers: many(teamMembers),
    activityLogs: many(activityLogs),
    invitations: many(invitations),
    linkedinConnection: one(linkedinConnections, {
        fields: [teams.id],
        references: [linkedinConnections.teamId],
    }),
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
export type LinkedinConnection = typeof linkedinConnections.$inferSelect;
export type NewLinkedinConnection = typeof linkedinConnections.$inferInsert;
export type LinkedinOAuthCredential = typeof linkedinOAuthCredentials.$inferSelect;
export type NewLinkedinOAuthCredential = typeof linkedinOAuthCredentials.$inferInsert;
export type ProspectFolder = typeof prospectFolders.$inferSelect;
export type NewProspectFolder = typeof prospectFolders.$inferInsert;
export type ProspectCandidate = typeof prospectCandidates.$inferSelect;
export type NewProspectCandidate = typeof prospectCandidates.$inferInsert;
export type LeadFolder = typeof leadFolders.$inferSelect;
export type NewLeadFolder = typeof leadFolders.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type ScheduledPost = typeof scheduledPosts.$inferSelect;
export type NewScheduledPost = typeof scheduledPosts.$inferInsert;
export type ContentBrief = typeof contentBriefs.$inferSelect;
export type NewContentBrief = typeof contentBriefs.$inferInsert;
export type IcpProfile = typeof icpProfiles.$inferSelect;
export type NewIcpProfile = typeof icpProfiles.$inferInsert;
export type WebhookConfig = typeof webhookConfigs.$inferSelect;
export type NewWebhookConfig = typeof webhookConfigs.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
export type TargetCompany = typeof targetCompanies.$inferSelect;
export type NewTargetCompany = typeof targetCompanies.$inferInsert;

export type TeamDataWithMembers = Team & {
    teamMembers: (TeamMember & {
        user: Pick<User, 'id' | 'name' | 'email'>;
    })[];
};

// ---------- PROSPECT FOLDERS TABLE ----------
export const prospectFolders = pgTable(
    'prospect_folders',
    {
        id: serial('id').primaryKey(),
        teamId: integer('team_id').references(() => teams.id).notNull(),
        name: varchar('name', { length: 255 }).notNull(),
        color: varchar('color', { length: 7 }).default('#3b82f6'), // hex color
        icon: varchar('icon', { length: 50 }).default('folder'), // lucide icon name
        isDefault: boolean('is_default').notNull().default(false),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (t) => ({
        teamIdx: index('prospect_folders_team_idx').on(t.teamId),
    })
);

// ---------- PROSPECT CANDIDATES TABLE (staging) ----------
export const prospectCandidates = pgTable(
    'prospect_candidates',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        teamId: integer('team_id').references(() => teams.id).notNull(),
        folderId: integer('folder_id').references(() => prospectFolders.id),
        source: varchar('source', { length: 50 }).notNull(),
        sourceRef: varchar('source_ref', { length: 1024 }).notNull(),
        action: varchar('action', { length: 50 }).notNull(),
        postUrl: varchar('post_url', { length: 1024 }),
        reactionType: varchar('reaction_type', { length: 50 }),
        commentId: varchar('comment_id', { length: 255 }),
        commentText: text('comment_text'),
        profileUrl: varchar('profile_url', { length: 512 }).notNull(),
        actorUrn: varchar('actor_urn', { length: 255 }),
        name: text('name'),
        title: text('title'),
        company: text('company'),
        location: text('location'),
        email: varchar('email', { length: 255 }),
        phone: varchar('phone', { length: 50 }),
        fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
        status: varchar('status', { length: 50 }).notNull().default('new'),
        aiScore: integer('ai_score'),
        aiReasoning: text('ai_reasoning'),
        enrichedProfile: jsonb('enriched_profile'),
        raw: jsonb('raw'),
    },
    (t) => ({
        uniqueCandidate: unique('prospect_candidates_unique').on(
            t.teamId,
            t.source,
            t.sourceRef,
            t.action,
            t.profileUrl,
            t.commentId
        ),
        postUrlIdx: index('prospect_candidates_post_url_idx').on(t.postUrl),
        statusIdx: index('prospect_candidates_status_idx').on(t.status),
        profileUrlIdx: index('prospect_candidates_profile_url_idx').on(t.profileUrl),
        folderIdx: index('prospect_candidates_folder_idx').on(t.folderId),
    })
);

// ---------- LEAD FOLDERS TABLE ----------
export const leadFolders = pgTable(
    'lead_folders',
    {
        id: serial('id').primaryKey(),
        teamId: integer('team_id').references(() => teams.id).notNull(),
        name: varchar('name', { length: 255 }).notNull(),
        color: varchar('color', { length: 7 }).default('#3b82f6'), // hex color
        icon: varchar('icon', { length: 50 }).default('folder'), // lucide icon name
        isDefault: boolean('is_default').notNull().default(false),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (t) => ({
        teamIdx: index('lead_folders_team_idx').on(t.teamId),
    })
);

// ---------- LEADS TABLE ----------
export const leads = pgTable(
    'leads',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        teamId: integer('team_id').references(() => teams.id).notNull(),
        folderId: integer('folder_id').references(() => leadFolders.id),
        email: varchar('email', { length: 255 }),
        phone: varchar('phone', { length: 50 }),
        firstName: varchar('first_name', { length: 120 }),
        lastName: varchar('last_name', { length: 120 }),
        company: text('company'),
        companySize: integer('company_size'),
        companyDomain: varchar('company_domain', { length: 255 }),
        title: text('title'),
        location: text('location'),
        industry: text('industry'),
        status: varchar('status', { length: 50 }).notNull().default('new'), // new | contacted | replied | qualified | lost
        score: integer('score').notNull().default(0),
        scoreReason: text('score_reason'),
        linkedinUrl: varchar('linkedin_url', { length: 512 }),
        profilePictureUrl: varchar('profile_picture_url', { length: 512 }),
        sourceMode: varchar('source_mode', { length: 50 }).notNull(), // chaud | espion | magnet | froid | monitoring
        sourcePostUrl: varchar('source_post_url', { length: 1024 }),
        engagementType: varchar('engagement_type', { length: 50 }), // reaction | comment
        reactionType: varchar('reaction_type', { length: 50 }), // LIKE | PRAISE | etc
        commentText: text('comment_text'),
        detectedPostId: uuid('detected_post_id').references(() => companyPosts.id),
        profileData: jsonb('profile_data'),
        tags: text('tags'),
        notes: text('notes'),
        lastContactedAt: timestamp('last_contacted_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (t) => ({
        teamIdx: index('leads_team_idx').on(t.teamId),
        folderIdx: index('leads_folder_idx').on(t.folderId),
        emailIdx: index('leads_email_idx').on(t.email),
        companyIdx: index('leads_company_idx').on(t.company),
        statusIdx: index('leads_status_idx').on(t.status),
        sourceIdx: index('leads_source_idx').on(t.sourceMode),
        linkedinIdx: index('leads_linkedin_idx').on(t.linkedinUrl),
        scoreIdx: index('leads_score_idx').on(t.score),
        detectedPostIdx: index('leads_detected_post_idx').on(t.detectedPostId),
    })
);
// ---------- ICP PROFILES ----------
export const icpProfiles = pgTable('icp_profiles', {
    id: serial('id').primaryKey(),
    teamId: integer('team_id').references(() => teams.id).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    industries: text('industries'),
    locations: text('locations'),
    buyerRoles: text('buyer_roles'),
    keywordsInclude: text('keywords_include'),
    keywordsExclude: text('keywords_exclude'),
    companySizeMin: integer('company_size_min').notNull().default(1),
    companySizeMax: integer('company_size_max').notNull().default(10000),
    productCategory: varchar('product_category', { length: 100 }),
    language: varchar('language', { length: 10 }).notNull().default('fr'),
    minScore: integer('min_score').notNull().default(50),
    problemStatement: text('problem_statement'),
    idealCustomerExample: text('ideal_customer_example'),
    suggestedCompanies: jsonb('suggested_companies').$type<string[]>().default([]),
    lastSearchOffset: integer('last_search_offset').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---------- MESSAGES TABLE ----------
export const messages = pgTable('messages', {
    id: serial('id').primaryKey(),
    teamId: integer('team_id').references(() => teams.id).notNull(),
    leadId: uuid('lead_id').references(() => leads.id).notNull(),
    messageText: text('message_text').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('draft'), // draft | approved | sent | delivered | failed
    channel: varchar('channel', { length: 50 }).notNull().default('linkedin'), // linkedin | email
    conversationId: varchar('conversation_id', { length: 255 }),
    sentAt: timestamp('sent_at'),
    deliveredAt: timestamp('delivered_at'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
    teamIdx: index('messages_team_idx').on(t.teamId),
    leadIdx: index('messages_lead_idx').on(t.leadId),
    statusIdx: index('messages_status_idx').on(t.status),
}));

// ---------- SCHEDULED POSTS TABLE ----------
export const scheduledPosts = pgTable('scheduled_posts', {
    id: serial('id').primaryKey(),
    teamId: integer('team_id').references(() => teams.id).notNull(),
    userId: integer('user_id').references(() => users.id).notNull(),
    postType: varchar('post_type', { length: 50 }).notNull().default('profile'), // profile | company
    companyUrl: varchar('company_url', { length: 512 }),
    messageText: text('message_text').notNull(),
    mediaUrls: jsonb('media_urls'),
    status: varchar('status', { length: 50 }).notNull().default('draft'), // draft | approved | scheduled | published | failed
    scheduledAt: timestamp('scheduled_at'),
    publishedAt: timestamp('published_at'),
    postUrl: varchar('post_url', { length: 1024 }),
    errorMessage: text('error_message'),
    metrics: jsonb('metrics'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
    teamIdx: index('scheduled_posts_team_idx').on(t.teamId),
    statusIdx: index('scheduled_posts_status_idx').on(t.status),
    scheduledIdx: index('scheduled_posts_scheduled_idx').on(t.scheduledAt),
}));

// ---------- CONTENT BRIEFS TABLE ----------
export const contentBriefs = pgTable('content_briefs', {
    id: serial('id').primaryKey(),
    teamId: integer('team_id').references(() => teams.id).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    objectives: text('objectives'),
    themes: text('themes'),
    tone: varchar('tone', { length: 100 }),
    cta: text('cta'),
    targetAudience: text('target_audience'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---------- WEBHOOK CONFIGS TABLE ----------
export const webhookConfigs = pgTable('webhook_configs', {
    id: serial('id').primaryKey(),
    teamId: integer('team_id').references(() => teams.id).notNull(),
    accountId: varchar('account_id', { length: 255 }).notNull(),
    accountName: varchar('account_name', { length: 255 }),
    webhookUrl: varchar('webhook_url', { length: 1024 }).notNull(),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
    teamIdx: index('webhook_configs_team_idx').on(t.teamId),
    accountIdx: index('webhook_configs_account_idx').on(t.accountId),
}));

// ---------- WEBHOOK EVENTS TABLE ----------
export const webhookEvents = pgTable('webhook_events', {
    id: serial('id').primaryKey(),
    teamId: integer('team_id').references(() => teams.id).notNull(),
    webhookConfigId: integer('webhook_config_id').references(() => webhookConfigs.id).notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    eventData: jsonb('event_data').notNull(),
    processed: boolean('processed').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
    teamIdx: index('webhook_events_team_idx').on(t.teamId),
    configIdx: index('webhook_events_config_idx').on(t.webhookConfigId),
    processedIdx: index('webhook_events_processed_idx').on(t.processed),
}));

// Relations for new tables
export const prospectFoldersRelations = relations(prospectFolders, ({ one, many }) => ({
    team: one(teams, {
        fields: [prospectFolders.teamId],
        references: [teams.id],
    }),
    prospects: many(prospectCandidates),
}));

export const prospectCandidatesRelations = relations(prospectCandidates, ({ one }) => ({
    team: one(teams, {
        fields: [prospectCandidates.teamId],
        references: [teams.id],
    }),
    folder: one(prospectFolders, {
        fields: [prospectCandidates.folderId],
        references: [prospectFolders.id],
    }),
}));

export const leadFoldersRelations = relations(leadFolders, ({ one, many }) => ({
    team: one(teams, {
        fields: [leadFolders.teamId],
        references: [teams.id],
    }),
    leads: many(leads),
}));

export const leadsRelations = relations(leads, ({ one }) => ({
    team: one(teams, {
        fields: [leads.teamId],
        references: [teams.id],
    }),
    folder: one(leadFolders, {
        fields: [leads.folderId],
        references: [leadFolders.id],
    }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
    team: one(teams, {
        fields: [messages.teamId],
        references: [teams.id],
    }),
    lead: one(leads, {
        fields: [messages.leadId],
        references: [leads.id],
    }),
}));

export const scheduledPostsRelations = relations(scheduledPosts, ({ one }) => ({
    team: one(teams, {
        fields: [scheduledPosts.teamId],
        references: [teams.id],
    }),
    user: one(users, {
        fields: [scheduledPosts.userId],
        references: [users.id],
    }),
}));

export const icpProfilesRelations = relations(icpProfiles, ({ one }) => ({
    team: one(teams, {
        fields: [icpProfiles.teamId],
        references: [teams.id],
    }),
}));

export const webhookConfigsRelations = relations(webhookConfigs, ({ one }) => ({
    team: one(teams, {
        fields: [webhookConfigs.teamId],
        references: [teams.id],
    }),
}));

// ---------- TARGET COMPANIES TABLE ----------
export const targetCompanies = pgTable(
    'target_companies',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        teamId: integer('team_id').references(() => teams.id).notNull(),
        icpId: integer('icp_id').references(() => icpProfiles.id),
        name: varchar('name', { length: 255 }).notNull(),
        industry: varchar('industry', { length: 255 }),
        reason: text('reason'),
        linkedinUrl: varchar('linkedin_url', { length: 512 }),
        website: varchar('website', { length: 512 }),
        status: varchar('status', { length: 50 }).notNull().default('not_contacted'),
        notes: text('notes'),
        contactProfile: jsonb('contact_profile').$type<{
            name: string;
            title: string;
            linkedinUrl: string;
            searchLevel: 'precise' | 'broad' | 'fallback';
            foundWithQuery: string;
        }>(),
        contactedAt: timestamp('contacted_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (t) => ({
        teamIdx: index('target_companies_team_idx').on(t.teamId),
        icpIdx: index('target_companies_icp_idx').on(t.icpId),
        statusIdx: index('target_companies_status_idx').on(t.status),
        nameIdx: index('target_companies_name_idx').on(t.name),
    })
);

export const targetCompaniesRelations = relations(targetCompanies, ({ one }) => ({
    team: one(teams, {
        fields: [targetCompanies.teamId],
        references: [teams.id],
    }),
    icp: one(icpProfiles, {
        fields: [targetCompanies.icpId],
        references: [icpProfiles.id],
    }),
}));

export const linkedinPostSettings = pgTable('linkedin_post_settings', {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
        .notNull()
        .references(() => teams.id)
        .unique(),
    postsPerWeek: integer('posts_per_week').notNull().default(2),
    autoValidationMode: boolean('auto_validation_mode').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const linkedinPosts = pgTable(
    'linkedin_posts',
    {
        id: serial('id').primaryKey(),
        teamId: integer('team_id')
            .notNull()
            .references(() => teams.id),
        type: varchar('type', { length: 50 }).notNull(),
        status: varchar('status', { length: 50 }).notNull().default('draft'),
        scheduledFor: timestamp('scheduled_for'),
        publishedAt: timestamp('published_at'),
        userContext: text('user_context'),
        generatedContent: text('generated_content'),
        finalContent: text('final_content'),
        imageUrl: text('image_url'),
        linkedinPostId: varchar('linkedin_post_id', { length: 255 }),
        createdBy: integer('created_by')
            .notNull()
            .references(() => users.id),
        validatedBy: integer('validated_by').references(() => users.id),
        validatedAt: timestamp('validated_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (t) => ({
        teamIdx: index('linkedin_posts_team_idx').on(t.teamId),
        statusIdx: index('linkedin_posts_status_idx').on(t.status),
        scheduledIdx: index('linkedin_posts_scheduled_idx').on(t.scheduledFor),
    })
);

export const linkedinPostSettingsRelations = relations(linkedinPostSettings, ({ one }) => ({
    team: one(teams, {
        fields: [linkedinPostSettings.teamId],
        references: [teams.id],
    }),
}));

export const linkedinPostsRelations = relations(linkedinPosts, ({ one }) => ({
    team: one(teams, {
        fields: [linkedinPosts.teamId],
        references: [teams.id],
    }),
    creator: one(users, {
        fields: [linkedinPosts.createdBy],
        references: [users.id],
    }),
    validator: one(users, {
        fields: [linkedinPosts.validatedBy],
        references: [users.id],
    }),
}));

export const decisionMakers = pgTable(
    'decision_makers',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        teamId: integer('team_id').references(() => teams.id).notNull(),
        companyId: uuid('company_id').references(() => targetCompanies.id).notNull(),
        firstName: varchar('first_name', { length: 255 }),
        lastName: varchar('last_name', { length: 255 }),
        fullName: text('full_name').notNull(),
        title: text('title'),
        email: varchar('email', { length: 255 }),
        phone: varchar('phone', { length: 50 }),
        linkedinUrl: varchar('linkedin_url', { length: 1024 }),
        profilePictureUrl: text('profile_picture_url'),
        relevanceScore: integer('relevance_score'),
        enrichmentData: jsonb('enrichment_data').$type<{
            headline?: string;
            location?: string;
            industry?: string;
            summary?: string;
            experience?: Array<{
                company: string;
                title: string;
                description?: string;
                start_date?: string;
                end_date?: string;
            }>;
            education?: Array<{
                school: string;
                degree?: string;
                field_of_study?: string;
                start_date?: string;
                end_date?: string;
            }>;
            skills?: string[];
        }>(),
        emailStatus: varchar('email_status', { length: 20 }).notNull().default('not_found'),
        phoneStatus: varchar('phone_status', { length: 20 }).notNull().default('not_found'),
        status: varchar('status', { length: 50 }).notNull().default('discovered'),
        notes: text('notes'),
        contactedAt: timestamp('contacted_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (t) => ({
        teamIdx: index('decision_makers_team_idx').on(t.teamId),
        companyIdx: index('decision_makers_company_idx').on(t.companyId),
        emailStatusIdx: index('decision_makers_email_status_idx').on(t.emailStatus),
        statusIdx: index('decision_makers_status_idx').on(t.status),
        linkedinUrlUnique: unique('decision_makers_linkedin_url_team_unique').on(t.linkedinUrl, t.teamId),
    })
);

export const decisionMakersRelations = relations(decisionMakers, ({ one }) => ({
    team: one(teams, {
        fields: [decisionMakers.teamId],
        references: [teams.id],
    }),
    company: one(targetCompanies, {
        fields: [decisionMakers.companyId],
        references: [targetCompanies.id],
    }),
}));

// ========== REAL-TIME MONITORING SYSTEM ==========

// Webhook Accounts - LinkUp webhook configuration
export const webhookAccounts = pgTable(
    'webhook_accounts',
    {
        id: serial('id').primaryKey(),
        teamId: integer('team_id').references(() => teams.id).notNull(),
        linkupAccountId: varchar('linkup_account_id', { length: 255 }).notNull(),
        accountName: varchar('account_name', { length: 255 }).notNull(),
        webhookUrl: text('webhook_url').notNull(),
        country: varchar('country', { length: 10 }).notNull().default('FR'),
        isActive: boolean('is_active').notNull().default(false),
        createdBy: integer('created_by').references(() => users.id).notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
        lastStartedAt: timestamp('last_started_at'),
        lastStoppedAt: timestamp('last_stopped_at'),
    },
    (t) => ({
        teamIdx: index('webhook_accounts_team_idx').on(t.teamId),
        linkupAccountIdUnique: unique('webhook_accounts_linkup_id_unique').on(t.linkupAccountId),
    })
);

// Monitored Companies - Liste des entreprises et profils suivis
export const monitoredCompanies = pgTable(
    'monitored_companies',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        teamId: integer('team_id').references(() => teams.id).notNull(),
        linkedinCompanyUrl: text('linkedin_company_url').notNull(),
        companyName: varchar('company_name', { length: 255 }).notNull(),
        companyId: varchar('company_id', { length: 255 }),
        logoUrl: text('logo_url'),
        profileType: varchar('profile_type', { length: 50 }).notNull().default('company'), // company | personal
        isActive: boolean('is_active').notNull().default(true),
        addedBy: integer('added_by').references(() => users.id).notNull(),
        addedAt: timestamp('added_at').notNull().defaultNow(),
        lastPostAt: timestamp('last_post_at'),
        lastCheckedAt: timestamp('last_checked_at'),
        totalPostsReceived: integer('total_posts_received').notNull().default(0),
    },
    (t) => ({
        teamIdx: index('monitored_companies_team_idx').on(t.teamId),
        linkedinUrlUnique: unique('monitored_companies_linkedin_url_team_unique').on(t.linkedinCompanyUrl, t.teamId),
        lastPostIdx: index('monitored_companies_last_post_idx').on(t.lastPostAt),
        profileTypeIdx: index('monitored_companies_profile_type_idx').on(t.profileType),
    })
);

// Company Posts - Posts reçus via webhook
export const companyPosts = pgTable(
    'company_posts',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        teamId: integer('team_id').references(() => teams.id).notNull(),
        monitoredCompanyId: uuid('monitored_company_id').references(() => monitoredCompanies.id).notNull(),
        postId: varchar('post_id', { length: 255 }).notNull(),
        postUrl: text('post_url').notNull(),
        authorName: varchar('author_name', { length: 255 }),
        authorUrl: text('author_url'),
        content: text('content'),
        postType: varchar('post_type', { length: 50 }).notNull().default('regular'),
        mediaUrls: jsonb('media_urls').$type<string[]>(),
        publishedAt: timestamp('published_at').notNull(),
        receivedAt: timestamp('received_at').notNull().defaultNow(),
        isNew: boolean('is_new').notNull().default(true),
        webhookPayload: jsonb('webhook_payload'),
    },
    (t) => ({
        teamIdx: index('company_posts_team_idx').on(t.teamId),
        companyIdx: index('company_posts_company_idx').on(t.monitoredCompanyId),
        postIdUnique: unique('company_posts_post_id_unique').on(t.postId, t.teamId),
        publishedAtIdx: index('company_posts_published_at_idx').on(t.publishedAt),
        isNewIdx: index('company_posts_is_new_idx').on(t.isNew),
    })
);

// Lead Collection Configs - Configuration de collecte par entreprise
export const leadCollectionConfigs = pgTable(
    'lead_collection_configs',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        teamId: integer('team_id').references(() => teams.id).notNull(),
        monitoredCompanyId: uuid('monitored_company_id').references(() => monitoredCompanies.id).notNull(),
        delayHours: integer('delay_hours').notNull().default(24),
        maxReactions: integer('max_reactions').notNull().default(50),
        maxComments: integer('max_comments').notNull().default(50),
        isEnabled: boolean('is_enabled').notNull().default(true),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (t) => ({
        teamIdx: index('lead_collection_configs_team_idx').on(t.teamId),
        companyUnique: unique('lead_collection_configs_company_unique').on(t.monitoredCompanyId),
    })
);

// Scheduled Collections - Tâches planifiées de collecte
export const scheduledCollections = pgTable(
    'scheduled_collections',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        teamId: integer('team_id').references(() => teams.id).notNull(),
        postId: uuid('post_id').references(() => companyPosts.id).notNull(),
        configId: uuid('config_id').references(() => leadCollectionConfigs.id).notNull(),
        scheduledFor: timestamp('scheduled_for').notNull(),
        status: varchar('status', { length: 50 }).notNull().default('pending'),
        maxReactionsOverride: integer('max_reactions_override'),
        maxCommentsOverride: integer('max_comments_override'),
        collectedAt: timestamp('collected_at'),
        reactionsCollected: integer('reactions_collected').notNull().default(0),
        commentsCollected: integer('comments_collected').notNull().default(0),
        leadsCreated: integer('leads_created').notNull().default(0),
        creditsUsed: integer('credits_used').notNull().default(0),
        errorMessage: text('error_message'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (t) => ({
        teamIdx: index('scheduled_collections_team_idx').on(t.teamId),
        postIdx: index('scheduled_collections_post_idx').on(t.postId),
        statusIdx: index('scheduled_collections_status_idx').on(t.status),
        scheduledForIdx: index('scheduled_collections_scheduled_for_idx').on(t.scheduledFor),
        postUnique: unique('scheduled_collections_post_unique').on(t.postId),
    })
);

// Relations
export const webhookAccountsRelations = relations(webhookAccounts, ({ one }) => ({
    team: one(teams, {
        fields: [webhookAccounts.teamId],
        references: [teams.id],
    }),
    createdByUser: one(users, {
        fields: [webhookAccounts.createdBy],
        references: [users.id],
    }),
}));

export const monitoredCompaniesRelations = relations(monitoredCompanies, ({ one, many }) => ({
    team: one(teams, {
        fields: [monitoredCompanies.teamId],
        references: [teams.id],
    }),
    addedByUser: one(users, {
        fields: [monitoredCompanies.addedBy],
        references: [users.id],
    }),
    posts: many(companyPosts),
    collectionConfig: one(leadCollectionConfigs),
}));

export const companyPostsRelations = relations(companyPosts, ({ one, many }) => ({
    team: one(teams, {
        fields: [companyPosts.teamId],
        references: [teams.id],
    }),
    monitoredCompany: one(monitoredCompanies, {
        fields: [companyPosts.monitoredCompanyId],
        references: [monitoredCompanies.id],
    }),
    scheduledCollection: one(scheduledCollections),
}));

export const leadCollectionConfigsRelations = relations(leadCollectionConfigs, ({ one }) => ({
    team: one(teams, {
        fields: [leadCollectionConfigs.teamId],
        references: [teams.id],
    }),
    monitoredCompany: one(monitoredCompanies, {
        fields: [leadCollectionConfigs.monitoredCompanyId],
        references: [monitoredCompanies.id],
    }),
}));

export const scheduledCollectionsRelations = relations(scheduledCollections, ({ one }) => ({
    team: one(teams, {
        fields: [scheduledCollections.teamId],
        references: [teams.id],
    }),
    post: one(companyPosts, {
        fields: [scheduledCollections.postId],
        references: [companyPosts.id],
    }),
    config: one(leadCollectionConfigs, {
        fields: [scheduledCollections.configId],
        references: [leadCollectionConfigs.id],
    }),
}));

export const campaigns = pgTable('campaigns', {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
        .notNull()
        .references(() => teams.id),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    blocks: jsonb('blocks').notNull().default('[]'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdBy: integer('created_by')
        .notNull()
        .references(() => users.id),
});

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
    team: one(teams, {
        fields: [campaigns.teamId],
        references: [teams.id],
    }),
    creator: one(users, {
        fields: [campaigns.createdBy],
        references: [users.id],
    }),
    blocks: many(campaignBlocks),
    prospects: many(campaignProspects),
    workflowNodes: many(workflowNodes),
    workflowEdges: many(workflowEdges),
}));

export const apiKeys = pgTable('api_keys', {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
        .notNull()
        .references(() => teams.id)
        .unique(),
    keyHash: text('key_hash').notNull(),
    keyPreview: varchar('key_preview', { length: 20 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at'),
    isActive: boolean('is_active').notNull().default(true),
});

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
    team: one(teams, {
        fields: [apiKeys.teamId],
        references: [teams.id],
    }),
}));

export const campaignBlocks = pgTable('campaign_blocks', {
    id: serial('id').primaryKey(),
    campaignId: integer('campaign_id')
        .notNull()
        .references(() => campaigns.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(),
    config: jsonb('config').notNull(),
    order: integer('order').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const campaignProspects = pgTable('campaign_prospects', {
    id: serial('id').primaryKey(),
    campaignId: integer('campaign_id')
        .notNull()
        .references(() => campaigns.id, { onDelete: 'cascade' }),
    prospectId: uuid('prospect_id')
        .notNull()
        .references(() => prospectCandidates.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at').notNull().defaultNow(),
    addedBy: integer('added_by')
        .notNull()
        .references(() => users.id),
});

export const campaignExecutions = pgTable('campaign_executions', {
    id: serial('id').primaryKey(),
    campaignProspectId: integer('campaign_prospect_id')
        .notNull()
        .references(() => campaignProspects.id, { onDelete: 'cascade' }),
    blockId: integer('block_id')
        .notNull()
        .references(() => campaignBlocks.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    scheduledAt: timestamp('scheduled_at').notNull(),
    executedAt: timestamp('executed_at'),
    error: text('error'),
    result: jsonb('result'),
});

export const campaignFolders = pgTable('campaign_folders', {
    id: serial('id').primaryKey(),
    campaignId: integer('campaign_id')
        .notNull()
        .references(() => campaigns.id, { onDelete: 'cascade' }),
    folderId: integer('folder_id')
        .notNull()
        .references(() => prospectFolders.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at').notNull().defaultNow(),
});

export const workflowNodes = pgTable('workflow_nodes', {
    id: serial('id').primaryKey(),
    campaignId: integer('campaign_id')
        .notNull()
        .references(() => campaigns.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(),
    config: jsonb('config').notNull().default('{}'),
    positionX: integer('position_x').notNull().default(0),
    positionY: integer('position_y').notNull().default(0),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const workflowEdges = pgTable('workflow_edges', {
    id: serial('id').primaryKey(),
    campaignId: integer('campaign_id')
        .notNull()
        .references(() => campaigns.id, { onDelete: 'cascade' }),
    sourceNodeId: integer('source_node_id')
        .notNull()
        .references(() => workflowNodes.id, { onDelete: 'cascade' }),
    targetNodeId: integer('target_node_id')
        .notNull()
        .references(() => workflowNodes.id, { onDelete: 'cascade' }),
    sourceHandle: varchar('source_handle', { length: 20 }),
    label: varchar('label', { length: 50 }),
    conditionType: varchar('condition_type', { length: 50 }),
    conditionValue: jsonb('condition_value'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const workflowProspectState = pgTable('workflow_prospect_state', {
    id: serial('id').primaryKey(),
    campaignProspectId: integer('campaign_prospect_id')
        .notNull()
        .references(() => campaignProspects.id, { onDelete: 'cascade' }),
    currentNodeId: integer('current_node_id')
        .references(() => workflowNodes.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 20 }).notNull().default('waiting'),
    scheduledFor: timestamp('scheduled_for'),
    lastExecutedAt: timestamp('last_executed_at'),
    completedAt: timestamp('completed_at'),
    error: text('error'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const campaignBlocksRelations = relations(campaignBlocks, ({ one, many }) => ({
    campaign: one(campaigns, {
        fields: [campaignBlocks.campaignId],
        references: [campaigns.id],
    }),
    executions: many(campaignExecutions),
}));

export const campaignProspectsRelations = relations(campaignProspects, ({ one, many }) => ({
    campaign: one(campaigns, {
        fields: [campaignProspects.campaignId],
        references: [campaigns.id],
    }),
    prospect: one(prospectCandidates, {
        fields: [campaignProspects.prospectId],
        references: [prospectCandidates.id],
    }),
    adder: one(users, {
        fields: [campaignProspects.addedBy],
        references: [users.id],
    }),
    executions: many(campaignExecutions),
}));

export const campaignExecutionsRelations = relations(campaignExecutions, ({ one }) => ({
    campaignProspect: one(campaignProspects, {
        fields: [campaignExecutions.campaignProspectId],
        references: [campaignProspects.id],
    }),
    block: one(campaignBlocks, {
        fields: [campaignExecutions.blockId],
        references: [campaignBlocks.id],
    }),
}));

export const campaignFoldersRelations = relations(campaignFolders, ({ one }) => ({
    campaign: one(campaigns, {
        fields: [campaignFolders.campaignId],
        references: [campaigns.id],
    }),
    folder: one(prospectFolders, {
        fields: [campaignFolders.folderId],
        references: [prospectFolders.id],
    }),
}));

export const workflowNodesRelations = relations(workflowNodes, ({ one, many }) => ({
    campaign: one(campaigns, {
        fields: [workflowNodes.campaignId],
        references: [campaigns.id],
    }),
    outgoingEdges: many(workflowEdges, { relationName: 'sourceNode' }),
    incomingEdges: many(workflowEdges, { relationName: 'targetNode' }),
}));

export const workflowEdgesRelations = relations(workflowEdges, ({ one }) => ({
    campaign: one(campaigns, {
        fields: [workflowEdges.campaignId],
        references: [campaigns.id],
    }),
    sourceNode: one(workflowNodes, {
        fields: [workflowEdges.sourceNodeId],
        references: [workflowNodes.id],
        relationName: 'sourceNode',
    }),
    targetNode: one(workflowNodes, {
        fields: [workflowEdges.targetNodeId],
        references: [workflowNodes.id],
        relationName: 'targetNode',
    }),
}));

export const workflowProspectStateRelations = relations(workflowProspectState, ({ one }) => ({
    campaignProspect: one(campaignProspects, {
        fields: [workflowProspectState.campaignProspectId],
        references: [campaignProspects.id],
    }),
    currentNode: one(workflowNodes, {
        fields: [workflowProspectState.currentNodeId],
        references: [workflowNodes.id],
    }),
}));

// Export types
export type WebhookAccount = typeof webhookAccounts.$inferSelect;
export type NewWebhookAccount = typeof webhookAccounts.$inferInsert;
export type MonitoredCompany = typeof monitoredCompanies.$inferSelect;
export type NewMonitoredCompany = typeof monitoredCompanies.$inferInsert;
export type CompanyPost = typeof companyPosts.$inferSelect;
export type NewCompanyPost = typeof companyPosts.$inferInsert;
export type LeadCollectionConfig = typeof leadCollectionConfigs.$inferSelect;
export type NewLeadCollectionConfig = typeof leadCollectionConfigs.$inferInsert;
export type ScheduledCollection = typeof scheduledCollections.$inferSelect;
export type NewScheduledCollection = typeof scheduledCollections.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type CampaignBlock = typeof campaignBlocks.$inferSelect;
export type NewCampaignBlock = typeof campaignBlocks.$inferInsert;
export type CampaignProspect = typeof campaignProspects.$inferSelect;
export type NewCampaignProspect = typeof campaignProspects.$inferInsert;
export type CampaignExecution = typeof campaignExecutions.$inferSelect;
export type NewCampaignExecution = typeof campaignExecutions.$inferInsert;
export type WorkflowNode = typeof workflowNodes.$inferSelect;
export type NewWorkflowNode = typeof workflowNodes.$inferInsert;
export type WorkflowEdge = typeof workflowEdges.$inferSelect;
export type NewWorkflowEdge = typeof workflowEdges.$inferInsert;
export type WorkflowProspectState = typeof workflowProspectState.$inferSelect;
export type NewWorkflowProspectState = typeof workflowProspectState.$inferInsert;
