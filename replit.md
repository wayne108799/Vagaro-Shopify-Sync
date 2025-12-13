# Vagaro x Shopify Sync

## Overview

This is a full-stack web application that synchronizes appointment data from Vagaro (a salon/spa management platform) to Shopify as draft orders. The system provides an admin dashboard for managing stylists, viewing orders, and configuring API integrations, plus a separate stylist portal where individual stylists can log in with a PIN to view their earnings and commissions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS v4 with shadcn/ui component library
- **Build Tool**: Vite

The frontend is organized in `client/src/` with:
- `pages/` - Route components (dashboard, stylist login, stylist dashboard)
- `components/ui/` - Reusable shadcn/ui components
- `lib/` - API utilities and query client configuration
- `hooks/` - Custom React hooks

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with tsx for TypeScript execution
- **Session Management**: express-session with in-memory storage
- **API Style**: RESTful JSON APIs

The server is organized in `server/` with:
- `index.ts` - Express app setup and middleware
- `routes.ts` - API route definitions
- `storage.ts` - Database access layer (repository pattern)
- `shopify.ts` - Shopify GraphQL API client
- `vagaro.ts` - Vagaro API client
- `vite.ts` - Vite dev server integration for development

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: Defined in `shared/schema.ts` using Drizzle's schema builder
- **Migrations**: Managed via `drizzle-kit push` command

Database tables:
- `users` - Admin users (username/password auth)
- `stylists` - Salon staff with commission rates and PIN hashes
- `orders` - Synced appointments/draft orders with financial data
- `settings` - API credentials for Vagaro and Shopify

### External Integrations
- **Vagaro API**: OAuth2 authentication, fetches appointments and employee data
- **Shopify Admin API**: GraphQL API for creating draft orders

### Authentication
- Admin dashboard: Session-based (no current auth implementation visible)
- Stylist portal: PIN-based login stored in session, 8-hour cookie expiry

### Development vs Production
- Development: Vite dev server with HMR, served through Express
- Production: Vite builds static files to `dist/public`, Express serves them

## External Dependencies

### Third-Party Services
- **Vagaro**: Salon management platform - requires `VAGARO_CLIENT_ID`, `VAGARO_CLIENT_SECRET`, `VAGARO_ENC_ID`, `VAGARO_REGION` environment variables
- **Shopify**: E-commerce platform - requires store URL and access token stored in settings table

### Database
- **PostgreSQL**: Requires `DATABASE_URL` environment variable

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit` - Database ORM and migrations
- `@tanstack/react-query` - Async state management
- `express-session` - Session management
- `zod` / `drizzle-zod` - Schema validation
- `date-fns` - Date utilities
- Full shadcn/ui component set via Radix UI primitives