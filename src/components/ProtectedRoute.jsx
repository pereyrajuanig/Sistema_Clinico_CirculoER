import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'

export default function ProtectedRoute(props) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-text-secondary text-base">
        Cargando...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return props.children
}
