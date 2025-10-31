# Next.js SaaS Starter

## Overview

This project is a full-stack B2B SaaS starter template built with Next.js 15, designed to provide a comprehensive foundation for developing modern SaaS products. It aims to empower users to build and scale SaaS applications efficiently by integrating features like subscription management, team collaboration, and AI-powered lead generation. The platform supports multi-tenancy with role-based access control and robust authentication and payment processing, leveraging advanced lead discovery and engagement tools to drive market potential.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend uses Next.js 15 with App Router and React Server Components for a server-first approach, incorporating Partial Prerendering and client segment cache. Styling is managed with TailwindCSS 4.x, Shadcn/ui, and Radix UI. SWR handles client-side data fetching, and `useActionState` manages form state.

### Backend

The backend utilizes Next.js API routes and Server Actions. Authentication is JWT-based with `jose` and `bcrypt`, storing tokens in HTTP-only cookies. Multi-tenant security is enforced through Server Actions, validating resource ownership and team context. PostgreSQL is the primary database, managed with Drizzle ORM.

### Key Features

*   **AI-Powered Lead Generation:** Includes various modes for prospect discovery from LinkedIn engagements, intelligent company targeting using GPT-4o, and an AI scoring pipeline for lead qualification. A "Target Companies" feature generates lists based on ICP. "Intelligent Contact Search" employs a 3-level cascade (LinkUp, then web search with GPT) to find decision-makers.
*   **LinkedIn Integration:** Supports dual authentication via LinkUp API (for profile enrichment) and LinkedIn OAuth (for official API access and post automation). OAuth tokens are subject to future encryption.
*   **LinkedIn Post Automation:** GPT-4o powers professional LinkedIn post creation and scheduled publishing via OAuth. It supports four post types with optimized prompts, configurable recurrence, and manual validation or auto-publish options.
*   **Decision-Maker Discovery & Management:** A unified AI-powered system combines LinkUp API and web search for comprehensive decision-maker discovery. It features an orchestrated cascade (LinkUp primary, web fallback), automated email/phone enrichment, and intelligent deduplication. Candidates are scored by GPT-4o and stored in a centralized `decision_makers` table.
*   **Automated LinkedIn Monitoring:** Users can monitor any LinkedIn profile (company or personal) for new posts. The system features dual detection modes: automatic cron-based checks (every 2H, 1 post per profile) and manual triggering (1-10 posts configurable via UI). When a post is detected, the system waits a configurable delay (default 24h) then automatically extracts leads (reactions and comments) using Apify actors. All leads are tagged with their source post for full attribution. Cost-optimized to minimize Apify usage while maintaining effective monitoring.
*   **Gmail Integration:** Secure Google OAuth integration allowing users to connect their Gmail accounts and access their mailboxes directly from the platform. Features include email listing, reading, and sending capabilities through the Gmail API. The integration uses secure state nonce validation with server-side storage to prevent token injection attacks and enforce strict multi-tenant isolation.

### Database Schema Highlights

Key tables include `users`, `teams`, `prospect_candidates`, `leads`, `linkedinConnections` (LinkUp auth), `linkedin_oauth_credentials` (OAuth tokens), `gmail_connections` (Gmail OAuth tokens), `oauth_states` (OAuth state nonces for CSRF protection), `target_companies`, `decision_makers`, `icp_profiles`, tables for LinkedIn post automation, and monitoring tables (`monitored_companies`, `company_posts`, `lead_collection_configs`, `scheduled_collections`).

**Prospects Folder Management:** The `prospect_folders` table provides folder organization for prospects. Each folder has a name, color, icon, and team association. Prospects can be assigned to folders via the `folderId` column in `prospect_candidates`. The system supports creating custom folders for better prospect organization.

**Leads vs Prospects UI:**
- **/dashboard/leads:** Displays a simple, flat list of all leads extracted from LinkedIn posts. Each lead is clickable and links to `/dashboard/leads/[id]` for detailed view with personalized messaging capabilities. No folder system on this page.
- **/dashboard/prospects:** Features a LinkedIn-style folder card interface for organizing prospects. Users can create custom folders (with name and color) and navigate between folders using search params (`?folder=X`). The default "Général" folder displays all prospects. When clicking on a folder, the page displays:
  - Folder statistics (total, converted, conversion rate)
  - List of prospects in the folder with clickable names linking to `/dashboard/prospects/[id]`
  - "View Post" button for prospects from LinkedIn posts
  - Back button to return to folder overview

**Visual Campaign Workflow Builder:**
- Built with React Flow for drag-and-drop visual workflow creation
- Features 12 block types: Start, Email, Call, Task, Transfer, Delay, WaitUntil, TimeSlot, Condition, VisitLinkedIn, AddConnection, and LinkedInMessage
- **Conditional Branching:** Condition nodes support Yes/No branching with dual output handles
- Green edges represent "Yes" paths, red edges represent "No" paths
- Each node displays its configuration visually (e.g., subject for emails, delay duration)
- Workflow state persisted in `workflow_nodes` and `workflow_edges` tables
- Multi-tenant security: All nodes and edges are validated to belong to the correct campaign/team
- Auto-migration: Existing linear `campaignBlocks` are automatically converted to graph-based workflows
- Drag blocks from sidebar into canvas to build complex, branching email sequences
- Visual positioning with zoom/pan controls for large workflows

**Email Automation in Workflows:**
- Email blocks fully functional with Gmail API integration
- Support for dynamic variable substitution using {{variable}} syntax
- Available variables: {{name}}, {{firstName}}, {{lastName}}, {{company}}, {{title}}, {{email}}, {{phone}}, {{linkedin}}
- Variables are automatically extracted from prospect data and replaced in both subject and body
- Robust error handling: Missing emails, Gmail connection failures, and API errors are captured and logged
- Email sending is executed via the cron job workflow processor (`server/cron/workflow-processor.ts`)
- Prospects without email addresses skip email nodes with appropriate error logging
- All email activity is tracked in the `workflow_prospect_state` table for full audit trail

### Security

The system employs JWT-based authentication, HTTP-only cookies, bcrypt hashing, Role-Based Access Control (RBAC), and strict multi-tenant data isolation. 

**OAuth Security:** All OAuth flows (Google, LinkedIn) use cryptographically secure state nonce validation to prevent CSRF and token injection attacks. State nonces are:
- Generated using `crypto.randomBytes(32)` for unpredictability
- Stored server-side in the `oauth_states` table with team/user binding
- Single-use only (marked as used after validation)
- Time-limited (10-minute expiration)
- Validated against current user session to prevent cross-team token injection

The callback validates that:
1. The state nonce exists and hasn't been used
2. The state hasn't expired
3. The current authenticated user matches the user who initiated the OAuth flow
4. The current team matches the team context from initiation

### Cost Optimization

*   **LinkUp API:** Cached profile enrichment calls to prevent redundant API usage.
*   **Apify Actors:** Optimized monitoring with dual approach:
    *   Automatic: 2-hour intervals, 1 post per profile (~$0.05/day for 5 profiles = $1.50/month)
    *   Manual: User-triggered with configurable post count (1-10 range) for immediate checks
*   **Actor Selection:** Uses `harvestapi/linkedin-profile-posts` ($2/1k runs) instead of `apimaestro` ($5/1k runs) for 60% cost reduction on post detection.

## External Dependencies

*   **Payment Processing:** Stripe (for subscriptions, billing, Checkout, Customer Portal, webhooks).
*   **Third-Party APIs:**
    *   **LinkUp API:** For LinkedIn data extraction and lead enrichment. Requires a login_token stored in `linkedinConnections` table.
    *   **OpenAI API:** GPT-4o for AI-powered lead scoring, content generation, and intelligent targeting.
    *   **Tavily API:** For intelligent web search as a fallback in decision-maker discovery.
    *   **Apify API:** For automated LinkedIn profile monitoring, post detection, and engagement extraction (reactions/comments). Uses actors: `harvestapi/linkedin-profile-posts` (post detection), `apimaestro/linkedin-post-reactions`, `apimaestro/linkedin-post-comments-replies-engagements-scraper-no-cookies` (engagement extraction).
    *   **Google Gmail API:** For mailbox access, email reading, and sending. Uses OAuth 2.0 with secure state validation. Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables.
*   **Database:** PostgreSQL (Replit managed) with Drizzle ORM.