'use client'

import { useAuth } from '@/providers/auth.provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Bienvenue, {user?.name || user?.email}</h1>
        <p className="text-muted-foreground">
          Voici votre tableau de bord
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Utilisateur</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="font-medium">Email</dt>
                <dd className="text-muted-foreground">{user?.email}</dd>
              </div>
              <div>
                <dt className="font-medium">ID</dt>
                <dd className="text-muted-foreground font-mono text-xs">
                  {user?.id}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stack</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="space-y-1 text-muted-foreground">
              <li>✅ Next.js 15 + App Router</li>
              <li>✅ Fastify Backend</li>
              <li>✅ PostgreSQL + Prisma</li>
              <li>✅ JWT Authentication</li>
              <li>✅ shadcn/ui + Tailwind</li>
              <li>✅ React Query</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
