import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'

export default function CambiarUsuario() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    async function salir() {
      try {
        const { error } = await logout()
        if (!vigente) return
        if (error) setError('No se pudo cerrar la sesión. Intentá nuevamente.')
        else navigate('/login', { replace: true })
      } catch {
        if (vigente) setError('No se pudo cerrar la sesión. Revisá la conexión.')
      }
    }
    salir()
    return () => { vigente = false }
  }, [logout, navigate, intento])

  return <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background text-text-primary">
    <p role="status">{error || 'Cerrando la sesión…'}</p>
    {error && <button className="btn-primary" onClick={() => { setError(''); setIntento((v) => v + 1) }}>Reintentar</button>}
  </div>
}
