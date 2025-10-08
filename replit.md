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
- Connection pooling via `pg` library
- Schema includes: users, teams, team_members, activity_logs, invitations, leads, icp_profiles

**Key Tables**:
- `users`: Authentication and profile data with soft deletes
- `teams`: Multi-tenant organization units with Stripe metadata
- `team_members`: Junction table for user-team relationships with roles
- `leads`: Contact management with LinkedIn integration
- `activity_logs`: Audit trail for user actions
- `icp_profiles`: Ideal Customer Profile definitions for lead discovery

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
- LinkUp API for LinkedIn social engagement data
  - Fetches post reactions and comments
  - Extracts profile URLs for lead generation
  - Mock mode available for development (`LINKUP_MOCK=1`)

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