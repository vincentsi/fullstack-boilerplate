# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a fullstack TypeScript boilerplate built as a Turborepo monorepo. The project is designed to be cloned and used as a foundation for new fullstack applications with authentication, security, and modern development practices pre-configured.

## Architecture

### Monorepo Structure

- `apps/backend/` - Fastify TypeScript backend with Prisma ORM
- `apps/frontend/` - Next.js 14+ frontend with App Router
- `packages/shared/` - Shared TypeScript types and utilities
- `packages/tsconfig/` - Shared TypeScript configurations
- `packages/eslint-config/` - Shared ESLint and Prettier configurations

### Key Design Patterns

- **Configuration Inheritance**: TypeScript configs extend from `packages/tsconfig/` (base.json, nextjs.json, node.json)
- **Shared Linting**: All packages use `@boilerplate/eslint-config` for consistent code style
- **Monorepo Orchestration**: Turborepo manages builds, caching, and task dependencies across packages

## Development Commands

### Root-level Commands (from monorepo root)

```bash
npm install              # Install all workspace dependencies
turbo dev               # Start all dev servers (backend + frontend)
turbo build             # Build all packages in dependency order
turbo lint              # Lint all packages
turbo type-check        # Type check all packages
turbo test              # Run tests across all packages
```

### Backend-specific Commands (from apps/backend/)

```bash
npm run dev             # Start backend dev server (tsx watch)
npm run build           # Compile TypeScript to dist/
npm start               # Run compiled code (production)
npm run type-check      # TypeScript check without emit
npm run lint            # ESLint check
npm test                # Run Jest tests
npm run test:watch      # Jest in watch mode
npm run db:generate     # Generate Prisma client
npm run db:push         # Push schema changes to DB
npm run db:migrate      # Create new migration
npm run db:studio       # Open Prisma Studio GUI
```

### Environment Setup

```bash
# First time setup
cd apps/backend
cp .env.example .env    # Copy environment template
# Edit .env with real values (DATABASE_URL, JWT_SECRET, etc.)
npm run db:push         # Push schema to database
npm run dev             # Start server at http://localhost:3001
```

### Package Management

- Root-level `npm install` installs dependencies for all workspace packages
- Each app/package has its own `package.json` for specific dependencies
- Workspace packages referenced with `@boilerplate/*` namespace

## Code Quality & Git Hooks

### Pre-commit Automation

- **Husky** manages Git hooks in `.husky/pre-commit`
- **lint-staged** runs on staged files only:
  - `*.{js,ts,tsx}`: ESLint fix + Prettier format
  - `*.{json,md}`: Prettier format

### ESLint Configuration

- Extends from `@boilerplate/eslint-config` package
- TypeScript-first rules with strict settings
- React/Next.js specific overrides for `.tsx/.jsx` files
- Integrates with Prettier (no formatting conflicts)

## TypeScript Configuration Strategy

### Shared Configs in `packages/tsconfig/`

- **base.json**: Common TypeScript settings (ES2022, strict mode, JSX preserve)
- **nextjs.json**: Frontend-specific (DOM types, Next.js plugin, path aliases)
- **node.json**: Backend-specific (CommonJS, Node types, dist output)

### Usage Pattern

Apps extend appropriate config:

```json
{
  "extends": "@boilerplate/tsconfig/nextjs.json" // or node.json
}
```

## Technology Stack

### Backend (Fastify + Prisma)

- **Framework**: Fastify 5.x for high performance
- **Database**: PostgreSQL with Prisma ORM 6.x (singleton pattern)
- **Environment**: dotenv + Zod validation (fail-fast on invalid config)
- **Validation**: Zod schemas for request/response validation
- **Security**: @fastify/helmet, @fastify/cors, @fastify/rate-limit, @fastify/compress
- **Error Handling**: Centralized handler for Zod, Prisma, JWT errors
- **Logging**: Pino with pino-pretty for development
- **Authentication**: JWT with bcrypt password hashing and refresh tokens
- **Hashing**: bcryptjs for password hashing
- **Testing**: Jest (unit) + Supertest (integration) - planned

### Backend Architecture

- **MVC Pattern**: Routes → Controllers → Services → Prisma
- **Path Aliases**: `@/config/*`, `@/services/*`, `@/routes/*`, etc.
- **Modular Structure**:
  ```
  src/
  ├── app.ts              # Fastify app factory (testable, no .listen)
  ├── server.ts           # Entry point (loads env, starts server)
  ├── config/
  │   ├── env.ts          # Zod-validated environment variables
  │   └── prisma.ts       # PrismaClient singleton with connection pooling
  ├── middlewares/
  │   ├── security.middleware.ts      # Helmet, CORS, Rate limit, Compression
  │   ├── auth.middleware.ts          # JWT verification
  │   └── error-handler.middleware.ts # Centralized error handling (Zod, Prisma, JWT)
  ├── routes/             # Route registration (health, auth)
  ├── controllers/        # Request handlers (auth controller)
  ├── services/           # Business logic (auth service)
  ├── schemas/            # Zod validation schemas (RegisterDTO, LoginDTO)
  └── types/              # TypeScript types & module declarations
  ```

### Frontend (Next.js)

- **Framework**: Next.js 14+ with App Router
- **Styling**: TailwindCSS + shadcn/ui components
- **State Management**: TanStack Query (React Query) for server state
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Axios with interceptors (auto token refresh)
- **Validation**: Zod schemas (shared with backend)
- **Icons**: lucide-react
- **Testing**: Playwright (E2E) - planned

### Frontend Architecture

- **Feature-based Structure**: Organized by domain (auth, dashboard) not by type
- **Route Groups**: `(auth)` for public routes, `(dashboard)` for protected routes
- **Provider Pattern**: QueryProvider → AuthProvider → App
- **Protected Routes**: HOC component for auth-only pages
- **Modular Structure**:
  ```
  apps/frontend/
  ├── app/
  │   ├── (auth)/           # Public routes (login, register)
  │   ├── (dashboard)/      # Protected routes (dashboard, profile)
  │   ├── layout.tsx        # Root layout with providers
  │   └── page.tsx          # Home page
  ├── components/
  │   ├── ui/               # shadcn/ui components
  │   ├── auth/             # ProtectedRoute HOC
  │   ├── forms/            # Reusable forms
  │   └── layouts/          # Navigation, layouts
  ├── features/             # Domain logic
  │   ├── auth/
  │   └── dashboard/
  ├── lib/
  │   ├── api/              # Typed API client (Axios)
  │   │   ├── client.ts     # Base client with interceptors
  │   │   └── auth.ts       # Auth API endpoints
  │   ├── utils/            # Helper functions
  │   └── validators/       # Zod schemas
  ├── providers/
  │   ├── query.provider.tsx    # React Query setup
  │   └── auth.provider.tsx     # Auth context + queries
  └── types/
      └── index.ts          # Shared TypeScript types
  ```

## Important Notes

### Boilerplate Usage

This repository is designed to be cloned for new projects:

1. Clone repo and rename directory
2. Remove `.git` and `git init` fresh repo
3. Update package names in all package.json files
4. Connect to new GitHub repository

### Current Status

The monorepo foundation is complete with:

- ✅ Turborepo configuration with pipelines
- ✅ Shared TypeScript configs (base, nextjs, node)
- ✅ Shared ESLint/Prettier configuration
- ✅ Git hooks with Husky + lint-staged
- ✅ Backend foundation (Fastify + Prisma ORM setup)
- ✅ Security middlewares (Helmet, CORS, Rate limiting)
- ✅ Environment validation with Zod + dotenv
- ✅ Logging with Pino (pretty logs in dev)
- ✅ Health check endpoint
- ✅ Authentication system (JWT with bcrypt, refresh tokens)
- ✅ Auth routes: register, login, refresh, logout, me
- ⏳ Frontend implementation (Next.js + shadcn/ui + React Query) - in progress
- ⏳ Testing setup - planned

### Package Scoping

Internal packages use `@boilerplate/` scope:

- `@boilerplate/tsconfig`
- `@boilerplate/eslint-config`
- `@boilerplate/shared` (planned)

These are marked as `private: true` and not published to npm.

## Documentation

### External Documentation (`../docs/`)

Comprehensive documentation outside the boilerplate for library references:

- **Library docs**: `docs/*.md` - General usage guides for Turborepo, TypeScript, Fastify, Prisma, dotenv, Next.js, etc.
- **Code explanations**: `docs/code-explanations/` - Detailed explanations of our specific implementations
  - `backend/` - Architecture, Fastify setup, Prisma config, env validation
  - `setup/` - Shared configs, monorepo patterns
  - `frontend/`, `shared/`, `deployment/` - To be added

### Key Documentation Files

- `docs/dotenv.md` - Environment variables management with dotenv
- `docs/code-explanations/backend/fastify-setup.md` - Complete Fastify architecture explanation
- `docs/code-explanations/backend/prisma-config.md` - Prisma schema and setup details
- `docs/code-explanations/backend/env-validation.md` - Environment validation with Zod
- `docs/code-explanations/backend/authentication.md` - Complete JWT auth system (register, login, middleware, security)

## Backend-Specific Patterns

### Environment Variables

- **Never access `process.env` directly** - Always import from `@/config/env`
- Environment validation happens at startup in `src/config/env.ts`
- Use Zod schemas to validate all env vars with strict types
- `.env` files are gitignored, `.env.example` provides templates

### Fastify Application Structure

- **Separation of concerns**: `app.ts` creates the Fastify instance (testable), `server.ts` starts it
- **Security first**: All apps must register security middlewares (Helmet, CORS, Rate limiting, Compression) before routes
- **Middleware order matters**: Security → Error Handler → Routes (auth middleware per-route)
- **Error Handling**: Use centralized error handler via `app.setErrorHandler()` instead of try-catch in controllers
- **Logging**: Use `app.log` (Pino) instead of `console.log` for structured logging

### Prisma Schema Conventions

- Use `cuid()` for primary keys (not autoincrement) - non-predictable, URL-safe IDs
- Enums for type-safe options (e.g., `Role` enum for user permissions)
- `@@map("table_name")` for custom table names (plural, snake_case)
- `createdAt` with `@default(now())` and `updatedAt` with `@updatedAt` on all models

### Path Aliases

All backend imports use TypeScript path aliases defined in `tsconfig.json`:

```typescript
import { env } from '@/config/env'
import { prisma } from '@/config/prisma'
import { userService } from '@/services/user.service'
import { authMiddleware } from '@/middlewares/auth.middleware'
import { errorHandler } from '@/middlewares/error-handler.middleware'
```

Never use relative imports like `../../../config/env`

### Database Connection

- **PrismaClient Singleton**: Always use `import { prisma } from '@/config/prisma'` instead of `new PrismaClient()`
- **Connection Pooling**: Configured in singleton with proper env-based logging
- **Development**: Singleton preserved across hot-reloads (prevents connection exhaustion)
- **Graceful Shutdown**: `disconnectPrisma()` function available for clean server shutdown
- **Logging**: Query logs disabled in dev by default (only errors/warnings), enable temporarily for debugging

### Authentication System

- **JWT Tokens**: Access token (15min) + Refresh token (7 days)
- **Password Security**: bcrypt hashing with salt rounds = 10
- **Protected Routes**: Use `authMiddleware` as preHandler in Fastify routes
- **User Context**: Middleware injects `request.user = { userId }` for authenticated requests
- **Controller Pattern**: Methods bound with `.bind(authController)` in routes to preserve `this` context

**Available Auth Routes:**
```typescript
POST /api/auth/register  // Body: { email, password, name? }
POST /api/auth/login     // Body: { email, password }
POST /api/auth/refresh   // Body: { refreshToken }
POST /api/auth/logout    // Client-side token deletion
GET  /api/auth/me        // Headers: { Authorization: "Bearer <token>" }
```

**Password Validation (Zod):**
- Minimum 8 characters
- At least one uppercase, one lowercase, one number
- Email normalized (toLowerCase, trim)

**Security Practices:**
- Never expose password hashes in API responses
- Generic error messages for login failures (don't reveal if email exists)
- JWT secrets must be 32+ characters (enforced by Zod)
- Use `request.user?.userId` to access authenticated user ID

### TypeScript Module Augmentation

Custom types are defined in `src/types/fastify.d.ts`:
```typescript
declare module 'fastify' {
  interface FastifyRequest {
    user?: { userId: string }
  }
}
```

This extends Fastify's types to include the `user` property injected by auth middleware.

### Error Handling Pattern

- **Centralized Handler**: Use `app.setErrorHandler(errorHandler)` in app setup
- **Controller Pattern**: Controllers can throw errors directly, handler catches them
- **Automatic Handling**: Zod validation errors, Prisma errors, JWT errors are handled automatically
- **Development vs Production**: Stack traces and error details only exposed in development
- **Example**:
  ```typescript
  // Controller - no try-catch needed
  async register(request, reply) {
    const data = registerSchema.parse(request.body) // Throws ZodError if invalid
    const user = await authService.register(data)   // Throws if email exists
    return reply.send({ user })                     // Error handler catches all
  }
  ```

### ESLint Configuration

Backend uses flat config format (`eslint.config.mjs`) for ESLint v9+:
- Ignores variables starting with `_` (destructuring pattern for unused values)
- Allows `request.user` augmentation without `any` type warnings
- TypeScript-first linting with `typescript-eslint`

## Frontend-Specific Patterns

### API Client (Typed Axios with Interceptors)

**NEVER use fetch() directly** - Always use the typed API client from `lib/api/`

#### Base Client Setup (`lib/api/client.ts`)

```typescript
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
})

// Auto-inject JWT token in ALL requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-refresh token on 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Refresh token logic here
      // Retry original request with new token
    }
    return Promise.reject(error)
  }
)
```

**Why this pattern?**
- ✅ Token automatically added to every request
- ✅ Refresh token handled transparently (user doesn't get logged out)
- ✅ Centralized error handling
- ✅ Single source of truth for API URL

#### API Endpoints (`lib/api/auth.ts`, etc.)

```typescript
import { apiClient } from './client'
import type { User } from '@/types'

export type LoginDTO = {
  email: string
  password: string
}

export type AuthResponse = {
  user: User
  accessToken: string
  refreshToken: string
}

export const authApi = {
  login: async (data: LoginDTO): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', data)
    return response.data
  },

  me: async (): Promise<{ user: User }> => {
    const response = await apiClient.get<{ user: User }>('/auth/me')
    return response.data
  }
}
```

**Usage in components:**
```typescript
// ✅ GOOD - Typed, centralized, automatic token
const result = await authApi.login({ email, password })

// ❌ BAD - Manual fetch, no types, repeated code
const response = await fetch('http://localhost:3001/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
})
```

### React Query Pattern

Use React Query for ALL server state (data from API):

```typescript
// ✅ GOOD - React Query handles caching, refetch, loading states
const { data: user, isLoading } = useQuery({
  queryKey: ['me'],
  queryFn: () => authApi.me()
})

// ✅ GOOD - Mutations with optimistic updates
const loginMutation = useMutation({
  mutationFn: authApi.login,
  onSuccess: (data) => {
    queryClient.setQueryData(['me'], data.user)
  }
})

// ❌ BAD - Manual state management, no caching
const [user, setUser] = useState(null)
const [loading, setLoading] = useState(true)
useEffect(() => {
  fetch('/auth/me').then(r => r.json()).then(setUser)
}, [])
```

**React Query Benefits:**
- Automatic caching (60s stale time by default)
- Background refetch
- Optimistic updates
- Loading/error states handled
- No manual useState/useEffect

### Authentication Flow

**Provider hierarchy in `app/layout.tsx`:**
```typescript
<QueryProvider>          {/* React Query setup */}
  <AuthProvider>         {/* Auth context + user state */}
    {children}
  </AuthProvider>
</QueryProvider>
```

**Auth Provider Pattern (`providers/auth.provider.tsx`):**
- Uses React Query internally for user data
- Exposes: `user`, `login()`, `register()`, `logout()`, `isAuthenticated`, `isLoading`
- Token storage in localStorage (can be switched to httpOnly cookies)

**Usage in components:**
```typescript
'use client'

import { useAuth } from '@/providers/auth.provider'

export function ProfilePage() {
  const { user, logout, isLoading } = useAuth()

  if (isLoading) return <Spinner />
  if (!user) return null

  return <div>Welcome {user.email}</div>
}
```

### Protected Routes Pattern

Use the `ProtectedRoute` HOC for authenticated-only pages:

```typescript
// app/(dashboard)/layout.tsx
import { ProtectedRoute } from '@/components/auth/protected-route'

export default function DashboardLayout({ children }) {
  return (
    <ProtectedRoute>
      {children}
    </ProtectedRoute>
  )
}
```

**How it works:**
1. Checks `isAuthenticated` from AuthProvider
2. Shows loading spinner while checking
3. Redirects to `/login` if not authenticated
4. Renders children if authenticated

### Form Validation Pattern

Use React Hook Form + Zod for ALL forms:

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema } from '@/lib/validators/auth'

export function LoginForm() {
  const form = useForm({
    resolver: zodResolver(loginSchema),  // Zod schema validation
    defaultValues: { email: '', password: '' }
  })

  const onSubmit = async (data) => {
    // data is typed and validated ✅
    await authApi.login(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />  {/* Auto error display */}
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}
```

**Why this pattern?**
- ✅ Type-safe with Zod schemas
- ✅ Client-side validation before API call
- ✅ Can reuse same Zod schemas from backend
- ✅ Minimal re-renders (only changed fields)
- ✅ Built-in error handling

### shadcn/ui Components

Use shadcn/ui for ALL UI components (not raw Tailwind):

```typescript
// ✅ GOOD - Accessible, styled, dark mode ready
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

<Button>Click me</Button>
<Input placeholder="Email" />

// ❌ BAD - Manual Tailwind, no accessibility
<button className="bg-blue-500 px-4 py-2">Click me</button>
<input className="border p-2" placeholder="Email" />
```

**Available components** (install as needed):
```bash
npx shadcn@latest add button input label card form
npx shadcn@latest add dropdown-menu dialog alert
```

### Path Aliases

Frontend uses `@/*` aliases defined in `tsconfig.json`:

```typescript
import { useAuth } from '@/providers/auth.provider'
import { authApi } from '@/lib/api/auth'
import { Button } from '@/components/ui/button'
import type { User } from '@/types'
```

Never use relative imports like `../../../providers/auth.provider`

### Environment Variables

Frontend env vars must start with `NEXT_PUBLIC_` to be exposed to the browser:

```env
# apps/frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001  # ← Backend API URL (port 3001, not 3000!)
```

```typescript
// Usage
const apiUrl = process.env.NEXT_PUBLIC_API_URL
```

**Port explanation:**
- Frontend (Next.js) runs on `http://localhost:3000` ← User visits this
- Backend (Fastify) runs on `http://localhost:3001` ← Frontend calls this API
- `NEXT_PUBLIC_API_URL` points to **backend** (3001) so frontend can fetch data

**Security note:** Only prefix with `NEXT_PUBLIC_` if it's safe to expose to the browser. Server-only secrets should NOT have this prefix.

## Workflow modification

🚨 **CRITICAL RULE - ALWAYS FOLLOW THIS** 🚨

**BEFORE editing any files, you MUST Read at least 3 files** that will help you to understand how to make a coherent and consistency.

This is **NON-NEGOTIABLE**. Do not skip this step under any circumstances. Reading existing files ensures:

- Code consistency with project patterns
- Proper understanding of conventions
- Following established architecture
- Avoiding breaking changes

**Types of files you MUST read:**

1. **Similar files**: Read files that do similar functionality to understand patterns and conventions
2. **Imported dependencies**: Read the definition/implementation of any imports you're not 100% sure how to use correctly - understand their API, types, and usage patterns

**Steps to follow:**

1. Read at least 3 relevant existing files (similar functionality + imported dependencies)
2. Understand the patterns, conventions, and API usage
3. Only then proceed with creating/editing files
