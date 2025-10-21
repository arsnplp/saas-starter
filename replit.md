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

### Database Schema Highlights

Key tables include `users`, `teams`, `prospect_candidates`, `leads`, `linkedinConnections` (LinkUp auth), `linkedin_oauth_credentials` (OAuth tokens), `target_companies`, `decision_makers`, `icp_profiles`, tables for LinkedIn post automation, and monitoring tables (`monitored_companies`, `company_posts`, `lead_collection_configs`, `scheduled_collections`).

### Security

The system employs JWT-based authentication, HTTP-only cookies, bcrypt hashing, Role-Based Access Control (RBAC), strict multi-tenant data isolation, and OAuth state validation for CSRF protection.

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
*   **Database:** PostgreSQL (Replit managed) with Drizzle ORM.