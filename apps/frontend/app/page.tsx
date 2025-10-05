'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/auth.provider'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-5xl font-bold tracking-tight">
          Fullstack TypeScript Boilerplate
        </h1>

        <p className="text-xl text-muted-foreground">
          Next.js 15 + Fastify + PostgreSQL + Prisma
          <br />
          Ready for production with authentication, testing, and deployment
        </p>

        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/login">Se connecter</Link>
          </Button>

          <Button asChild variant="outline" size="lg">
            <Link href="/register">S&apos;inscrire</Link>
          </Button>
        </div>

        <div className="pt-8 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
          <div>✅ TypeScript strict</div>
          <div>✅ Monorepo Turborepo</div>
          <div>✅ JWT Auth</div>
          <div>✅ shadcn/ui</div>
          <div>✅ React Query</div>
          <div>✅ Zod validation</div>
        </div>
      </div>
    </div>
  )
}
