import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'

export default function ProtectedRoute(props) {
  const { session, profesional, loading, errorAcceso } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-text-secondary text-base">
        Cargando...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (!profesional) return <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background text-text-primary">
    <p role="alert">{errorAcceso || 'No se pudo identificar al profesional.'}</p>
    <Link to="/cambiar-usuario" className="btn-primary">Volver a elegir usuario</Link>
  </div>

  // Desmontar formularios y estados al cambiar de cuenta.
  return <div key={session.user.id}>{props.children}</div>
}
