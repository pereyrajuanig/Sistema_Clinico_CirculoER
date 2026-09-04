import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import logo from '@/assets/Logo-Circulo_FondoTransparente.png'

export default function Login() {
  const { login, session } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (session) navigate('/', { replace: true })
  }, [session, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await login(email, password)
    setLoading(false)
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-surface shadow-sm rounded-lg p-6 sm:p-8 w-full max-w-sm space-y-4 border border-border"
      >
        <img
          src={logo}
          alt="Círculo de Retirados y Pensionados de la Policía de Entre Ríos"
          className="h-32 sm:h-55 mx-auto"
        />

        <h1 className="text-2xl font-bold text-accent-marino text-center">
          Historia Clínica — Círculo Policía
        </h1>

        <div className="space-y-1">
          <label className="text-sm text-text-secondary">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-text-secondary">Contraseña</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>

        {error && <p className="text-sm text-alert">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>

        <p className="text-sm text-text-secondary text-center">
          Esta sesión queda guardada en esta computadora — no hace falta volver a loguearse cada vez.
        </p>
      </form>
    </div>
  )
}