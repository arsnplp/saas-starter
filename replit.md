# Next.js SaaS Starter

## Overview

This is a full-stack SaaS starter template built with Next.js 15, featuring subscription management, team collaboration, and lead generation capabilities. The application provides a complete foundation for building modern SaaS products with authentication, payment processing, and multi-tenancy support.

The system is designed as a B2B SaaS platform with:
- Marketing website with pricing pages
- User authentication and session management
- Team-based multi-tenancy with role-based access control
- Stripe subscription management
- Lead generation and tracking system
- Activity logging for audit trails
- LinkedIn integration for social engagement tracking

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: Next.js 15 with App Router and React Server Components
- Uses experimental features: PPR (Partial Prerendering), client segment cache, and node middleware
- Server-first rendering with selective client components ("use client" directives)
- SWR for client-side data fetching with fallback data from server
- Shadcn/ui component library with Radix UI primitives
- TailwindCSS 4.x for styling with custom theme variables

**Routing Structure**:
- Public routes: `/` (landing), `/pricing`
- Authentication routes: `/sign-in`, `/sign-up`
- Protected dashboard routes: `/dashboard/*` with nested settings pages
- Additional features: `/leads`, `/icp`, `/engagement/post`

**State Management**:
- Server state via React Server Components and Server Actions
- Client state using SWR for data fetching with optimistic updates
- Form state managed through `useActionState` hook
- Session state stored in HTTP-only cookies

### Backend Architecture

**API Layer**:
- Next.js API routes for data endpoints (`/api/user`, `/api/team`)
- Server Actions for mutations (create, update, delete operations)
- Stripe webhook handlers for subscription events
- Custom middleware for authentication and route protection

**Authentication & Authorization**:
- JWT-based session management using `jose` library
- Tokens stored in HTTP-only, secure, SameSite cookies
- bcrypt for password hashing (10 salt rounds)
- Role-based access control (Owner/Member roles)
- Global middleware protects `/dashboard` routes
- Session refresh on GET requests (24-hour expiration)

**Database Layer**:
- PostgreSQL as primary database
- Drizzle ORM for type-safe database queries
- Connection pooling via `pg` library with 5-second timeout
- Schema includes: users, teams, team_members, activity_logs, invitations, prospect_candidates, leads, messages, icp_profiles

**Key Tables**:
- `users`: Authentication and profile data with soft deletes
- `teams`: Multi-tenant organization units with Stripe metadata
- `team_members`: Junction table for user-team relationships with roles
- `prospect_candidates`: **Staging table** for LinkedIn engagements (reactions/comments) before manual validation
- `leads`: **Qualified contacts** after manual validation and conversion from prospects
- `messages`: Outbound communications sent to leads (LinkedIn DMs, emails)
- `activity_logs`: Audit trail for user actions
- `icp_profiles`: Ideal Customer Profile definitions for lead discovery
  - Required fields: industries, locations, buyer_roles, keywords_include/exclude, company_size_min/max, min_score
  - **Optional context fields** (added Oct 2025): `problem_statement` (TEXT - description du produit/entreprise), `ideal_customer_example` (TEXT)
  - Context fields enhance AI scoring with product description and perfect customer example for calibration

**Lead Generation Workflow** (AI-Powered):

**Mode 1-3 (Chaud/Espion/Magnet)**: LinkedIn post engagement → `prospect_candidates` (staging)

**Mode 4 (Lead Froid)** - **NEW Approach (Oct 2025)**:
1. **GPT generates 10-15 target companies** based on ICP criteria (industries, problem_statement, ideal_customer_example)
   - Avoids previously suggested companies (stored in `icp_profiles.suggestedCompanies` JSONB field)
   - Temperature 0.8 for creative variation each search
2. **Search profiles in target companies**: For each company, search LinkUp for profiles matching buyer role
   - Query format: `{buyerRole} {companyName}` (e.g., "CTO Doctolib")
   - Max 5 profiles per company
   - Filters invalid URLs (search results pages, headless, "Utilisateur LinkedIn")
3. **Cost-optimized batching**: Stops at 10 qualified profiles OR 50 total profiles (5 credits max)
4. **Display companies used**: UI shows which companies yielded results for transparency

**AI Scoring Pipeline** (Modes 1-3):
- Click "Scorer" button triggers profile enrichment via LinkUp API (`/v1/profile/info`)
- Enriched profile includes: name, headline, location, industry, experience (with company_size), education, skills
- OpenAI GPT-4o analyzes profile against ICP criteria using **adaptive weighting system**:
  - **Fit Métier** (0-30pts): Decision-making power and role alignment
  - **Fit Entreprise** (0-25pts): Company size (strict), industry, context
  - **Fit Problème** (0-25pts): Signals of business problem we solve (uses `problem_statement` if provided)
  - **Signaux Exclusion** (-50pts penalty): Presence of exclusion keywords
  - **Localisation** (0-10pts): Geographic alignment
  - **Signaux d'Achat Bonus** (0-10pts): Recent job change, company growth indicators
- Uses `ideal_customer_example` for score calibration when provided (90-100 = near-perfect match)
- Returns JSON: `{ score: 0-100, reasoning: "detailed breakdown + recommendation" }` in French
- Stores `ai_score`, `ai_reasoning`, `enriched_profile` in `prospect_candidates`

**Auto-Promotion Logic**:
- If score ≥ `icp_profiles.minScore` → automatically converts to `leads` table
- If score < minScore → remains in prospects with status 'analyzed'

**Outreach**: Messages stored in `messages` table

**Cost Optimization Strategy**:
- LinkUp API charged 1 credit per profile enrichment
- Enrichment only happens once per prospect (cached in `enriched_profile` JSONB field)
- Subsequent scoring reuses cached data to avoid redundant API calls

**Business Logic Patterns**:
- Server Actions with Zod schema validation
- Middleware wrappers for authentication (`validatedActionWithUser`, `withTeam`)
- Activity logging for compliance and audit trails
- Optimistic UI updates with server-side revalidation

### External Dependencies

**Payment Processing**:
- Stripe for subscription management and billing
- Stripe Checkout for payment collection
- Stripe Customer Portal for self-service subscription management
- Webhook integration for real-time subscription status updates
- Products: Base ($8/month) and Plus ($12/month) plans with 7-14 day trials

**Third-Party APIs**:
- **LinkUp API** for LinkedIn data extraction
  - `/posts/reactions` & `/posts/extract-comments`: Fetches post engagements
  - `/v1/profile/info`: Enriches LinkedIn profiles (name, headline, experience, education, skills, company size)
  - Mock mode available for development (`LINKUP_MOCK=1`)
  - Cost: 1 credit per profile enrichment
- **OpenAI API** for AI-powered lead scoring
  - Model: GPT-4o
  - Analyzes LinkedIn profiles against ICP criteria
  - Returns JSON: `{ score: 0-100, reasoning: "..." }`
  - Handles missing data gracefully (e.g., awards 5/10 for company size if unavailable)

**Database**:
- PostgreSQL (Replit managed Postgres)
- SSL connection with certificate validation (enabled when sslmode=require)
- Environment variables: `DATABASE_URL` or `POSTGRES_URL`

**Development Tools**:
- Drizzle Kit for schema migrations and database studio
- TypeScript for type safety
- Stripe CLI for local webhook testing

**Environment Configuration**:
Required environment variables:
- `AUTH_SECRET`: JWT signing key
- `DATABASE_URL` or `POSTGRES_URL`: PostgreSQL connection string
- `STRIPE_SECRET_KEY`: Stripe API key
- `STRIPE_WEBHOOK_SECRET`: Webhook signature verification
- `BASE_URL`: Application base URL for redirects (auto-configured from REPLIT_DEV_DOMAIN)
- `LINKUP_API_KEY`: LinkedIn engagement API (optional)
- `OPENAI_API_KEY`: OpenAI API key for AI-powered lead scoring

**Replit-Specific Configuration**:
- Server runs on port 5000, binding to 0.0.0.0
- Turbopack disabled for stability (removed from dev script)
- BASE_URL automatically configured using REPLIT_DEV_DOMAIN environment variable
- Database uses Replit managed PostgreSQL with proper SSL certificate validation
- All secrets managed through Replit Secrets for security

**Key Integrations**:
1. **Stripe Integration**: Handles checkout sessions, customer portal, and webhook events for subscription lifecycle
2. **LinkedIn Integration**: Imports leads from post engagement (reactions/comments) via LinkUp API
3. **Email System**: Team invitations with token-based acceptance flow (schema includes invitations table)