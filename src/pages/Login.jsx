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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-sm rounded-xl p-6 sm:p-8 w-full max-w-sm space-y-4 border border-slate-200"
      >
        <img
          src={logo}
          alt="Círculo de Retirados y Pensionados de la Policía de Entre Ríos"
          className="h-32 sm:h-55 mx-auto"
        />

        <h1 className="text-xl font-semibold text-slate-800 text-center">
          Historia Clínica — Círculo Policía
        </h1>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Contraseña</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-2.5"
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>

        <p className="text-xs text-slate-400 text-center">
          Esta sesión queda guardada en esta computadora — no hace falta volver a loguearse cada vez.
        </p>
      </form>
    </div>
  )
}