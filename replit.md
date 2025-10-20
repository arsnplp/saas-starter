# Next.js SaaS Starter

## Overview

This project is a full-stack B2B SaaS starter template built with Next.js 15. Its primary purpose is to provide a comprehensive foundation for developing modern SaaS products, incorporating features like subscription management, team collaboration, and AI-powered lead generation. The platform supports multi-tenancy with role-based access control and integrates robust authentication and payment processing capabilities. The business vision is to empower users to build and scale SaaS applications efficiently, leveraging advanced lead discovery and engagement tools to drive market potential.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with Next.js 15, utilizing the App Router and React Server Components for a server-first rendering approach. It incorporates experimental features like Partial Prerendering (PPR), client segment cache, and Node.js middleware. Styling is handled by TailwindCSS 4.x with Shadcn/ui and Radix UI primitives for components. SWR is used for client-side data fetching with server-provided fallback data, and form state is managed via the `useActionState` hook.

### Backend Architecture

The backend leverages Next.js API routes and Server Actions for data operations and mutations. Authentication is JWT-based, using `jose` with tokens stored in HTTP-only cookies and `bcrypt` for password hashing. A critical architectural decision is the enforcement of multi-tenant security, ensuring all Server Actions derive team context from authenticated sessions and validate resource ownership to prevent cross-team data access. PostgreSQL is the primary database, managed with Drizzle ORM for type-safe queries.

**Key Features and Implementations:**

*   **Lead Generation Workflow (AI-Powered):**
    *   **Modes 1-3 (Engagement-based):** Prospects from LinkedIn post engagements are staged in `prospect_candidates`.
    *   **Mode 4 (Intelligent Company Targeting):** GPT generates qualified target companies (10-15 per ICP) with precision filtering, detecting final clients, excluding irrelevant entities (e.g., SSII/ESN), and providing LinkedIn company URLs. GPT uses `problem_statement` and `ideal_customer_example` for accurate targeting. It returns structured JSON for reliable parsing.
    *   **AI Scoring Pipeline:** GPT-4o analyzes enriched LinkedIn profiles against ICP criteria using an adaptive weighting system (Fit Métier, Fit Entreprise, Fit Problème, Exclusion Signals, Localisation, Achat Bonus). Scores ≥ `minScore` automatically promote prospects to `leads`.
    *   **Target Companies Feature:** A simplified, GPT-powered discovery tool for generating lists of relevant companies based on ICP, storing them in `target_companies` for manual prospecting. No LinkUp credits are used for this feature.
    *   **Intelligent Contact Search:** A manual, on-demand feature that uses a 3-level cascade search strategy (Precise, Broad, Fallback) with GPT-generated title variations and LinkUp API to find the right contact person at target companies. It stores contact profiles in the `target_companies` table.

*   **LinkedIn Integration (Dual Authentication):**
    *   **LinkUp login_token** (table: `linkedinConnections`): For profile enrichment via LinkUp API. Users authenticate via email/password, token stored per team.
    *   **LinkedIn OAuth** (table: `linkedin_oauth_credentials`): For official LinkedIn API access. Full OAuth 2.0 flow with state validation (CSRF protection), access/refresh tokens, automatic refresh before expiration.
    *   **Security considerations**: 
        - OAuth state validated via HTTP-only cookies (10min TTL)
        - Tokens currently stored in plaintext - **TODO: Implement encryption** using KMS or env-based encryption key before production
        - **Required secrets**: `LINKEDIN_CLIENT_ID` (configured), `LINKEDIN_CLIENT_SECRET` (⚠️ missing - required for OAuth token exchange)

*   **LinkedIn Post Automation (NEW - October 2025):**
    *   **Automated Content Publishing:** GPT-4o powered LinkedIn post creation with professional copywriting, scheduled publication via LinkedIn OAuth API.
    *   **4 Post Types:** Call-to-action (📣), Publicité (📢), Annonce (🎉), Classique (💬) - each with optimized GPT prompt.
    *   **Workflow:**
        1. User configures recurrence (posts/week) in `/dashboard/posts/settings`
        2. Empty post slots auto-created weekly
        3. User selects post type, adds context/images
        4. GPT generates engaging content using custom LinkedIn copywriting prompt
        5. Manual validation OR auto-publish mode (configurable)
        6. Scheduled publishing via `/api/posts/publish` (CRON-compatible, secured with INGEST_API_TOKEN)
        7. Manual "Publish Now" option available per post
    *   **Tables:** `linkedin_post_settings` (team recurrence config, auto-mode), `linkedin_posts` (post content, schedule, status)
    *   **Services:** `LinkedInPublisher` (OAuth-based publishing with image upload), `LinkedInPostGenerator` (GPT content creation)
    *   **Security:** Team-scoped data isolation, OAuth token auto-refresh, scheduler API secured with bearer token

*   **Decision-Maker Discovery & Management (UNIFIED SYSTEM - October 2025):**
    *   **Unified Intelligent Search:** AI-powered discovery combining LinkUp API precision with web search resilience for maximum coverage.
    *   **Architecture (Orchestrated Cascade):**
        - **Primary Path (LinkUp):** Direct LinkedIn profile search by job title → GPT-4o scoring → Full profiles with photos
        - **Fallback Path (Web Search):** Tavily web search → GPT extracts decision-makers → Web-based LinkedIn profile discovery
        - **Automatic Enrichment:** Multi-source cascade (company site → LinkedIn public → web) for email/phone immediately after discovery
        - **Intelligent Deduplication:** Merges candidates from both sources by LinkedIn URL > email > name+company
    *   **Key Features:**
        - Single-button UX: One "Trouver des décideurs" button triggers entire workflow
        - Automated search across curated job titles (CTO, CEO, Head of Innovation, Facility Manager, etc.)
        - GPT-4o unified scoring (0-100) for all candidates regardless of source
        - Automatic email/phone enrichment (no manual "Enrichir" button needed)
        - Resilient to LinkUp API failures (seamless fallback to web)
        - Persistent storage in `decision_makers` table with team scoping
    *   **User Workflow:**
        1. Navigate to company detail page (`/dashboard/entreprises/[id]`)
        2. Click "Trouver des décideurs" → System automatically tries LinkUp, falls back to web if needed
        3. GPT scores all candidates (threshold: ≥60/100) from both sources uniformly
        4. Automatic multi-source enrichment finds email/phone immediately
        5. View results with LinkedIn profiles (when found), photos, scores, AND contact info
        6. Access centralized "Base de Décideurs" (`/dashboard/decideurs`) to view all enriched contacts
    *   **Tables:** `decision_makers` (nullable linkedinUrl for web-found contacts without profiles)
    *   **Services:** 
        - `DecisionMakerOrchestrator.findAndEnrichDecisionMakers` (unified orchestrator)
        - `searchViaLinkUp` (LinkUp search with GPT scoring)
        - `searchViaWeb` (Tavily search with GPT extraction and scoring)
        - `enrichContactInfo` (multi-source cascade: company site → LinkedIn → web)
    *   **LinkUp API Wrappers:**
        - `searchLinkedInProfiles` (search by company + title)
        - `enrichLinkedInProfile` (email/phone enrichment by name + company)
    *   **Web Search Integration:**
        - Tavily API for intelligent web search
        - GPT-4o for contact extraction and LinkedIn profile discovery
    *   **Security:** All queries scoped to `teamId`, strict ownership validation, no cross-team data access
    *   **Resilience:** Circuit-breaker pattern for LinkUp failures, automatic fallback, no user intervention needed
    *   **Cost Optimization:** LinkUp tried first (high-quality data), web search only when needed; enrichment runs once per candidate

*   **Database Schema Highlights:**
    *   `users`, `teams`, `team_members`, `activity_logs`, `invitations`.
    *   `prospect_candidates`: Staging table for LinkedIn engagements.
    *   `leads`: Qualified contacts.
    *   `linkedinConnections`: LinkUp authentication (login_token per team).
    *   `linkedin_oauth_credentials`: OAuth tokens (access_token, refresh_token, expiry) with auto-refresh logic.
    *   `target_companies`: GPT-generated target companies with status tracking and `contactProfile` JSONB for found contacts.
    *   `decision_makers`: Decision-maker profiles with contact information (email, phone), LinkedIn URL, relevance scores, enrichment status, and team/company associations.
    *   `messages`: Outbound communications.
    *   `icp_profiles`: Ideal Customer Profile definitions, including `problem_statement` and `ideal_customer_example` for enhanced AI scoring.

*   **Security:** JWT-based authentication, HTTP-only cookies, bcrypt hashing, Role-Based Access Control (RBAC), strict multi-tenant data isolation, OAuth state validation (CSRF protection).

*   **Cost Optimization:** LinkUp API profile enrichment is performed only once per prospect and cached, avoiding redundant API calls.

## External Dependencies

*   **Payment Processing:** Stripe for subscription management, billing, Checkout, Customer Portal, and webhook integration.
*   **Third-Party APIs:**
    *   **LinkUp API:** For LinkedIn data extraction (post engagements, profile enrichment). A mock mode is available for development.
    *   **OpenAI API:** GPT-4o for AI-powered lead scoring and intelligent company/contact targeting.
*   **Database:** PostgreSQL (Replit managed) with Drizzle ORM.
*   **Development Tools:** Drizzle Kit, TypeScript, Stripe CLI.