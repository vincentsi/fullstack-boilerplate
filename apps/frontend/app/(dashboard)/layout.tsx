import { ProtectedRoute } from '@/components/auth/protected-route'
import { DashboardNav } from '@/components/layouts/dashboard-nav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50">
        <DashboardNav />
        <main className="container mx-auto py-8 px-4">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  )
}
