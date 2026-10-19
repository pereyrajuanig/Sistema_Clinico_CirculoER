import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import logo from '@/assets/Logo-Circulo_FondoTransparente.png'
import ThemeToggle from '@/components/ThemeToggle'

export default function Login() {
  const { login, session, profesional, loading: verificando, errorAcceso } = useAuth()
  const navigate = useNavigate()
  const [accesos, setAccesos] = useState([])
  const [seleccionado, setSeleccionado] = useState(null)
  const [cargandoAccesos, setCargandoAccesos] = useState(true)
  const [intento, setIntento] = useState(0)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (profesional) navigate(profesional.debe_cambiar_password === false ? '/' : '/cambiar-contrasena', { replace: true })
  }, [profesional, navigate])

  useEffect(() => {
    let vigente = true
    async function cargar() {
      try {
        const { data, error } = await supabase.rpc('listar_profesionales_acceso')
        if (!vigente) return
        if (error) setError('No se pudieron cargar los usuarios. Revisá la conexión o la configuración de acceso.')
        else setAccesos(data || [])
      } catch {
        if (vigente) setError('No se pudieron cargar los usuarios. Revisá la conexión.')
      } finally {
        if (vigente) setCargandoAccesos(false)
      }
    }
    cargar()
    return () => { vigente = false }
  }, [intento])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!seleccionado || loading) return
    setError('')
    setLoading(true)
    const { error } = await login(seleccionado.email, password)
    setPassword('')
    setLoading(false)
    if (error) setError('No se pudo ingresar. Revisá la contraseña e intentá nuevamente.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <form
        onSubmit={handleSubmit}
        className="bg-surface shadow-sm rounded-lg p-6 sm:p-8 w-full max-w-lg space-y-5 border border-border"
      >
        <img
          src={logo}
          alt="Círculo de Retirados y Pensionados de la Policía de Entre Ríos"
          className="h-28 sm:h-40 mx-auto"
        />

        <h1 className="text-2xl font-bold text-text-primary text-center">
          Historia Clínica — Círculo Policía
        </h1>

        {verificando ? <p role="status" className="text-text-secondary">Verificando la sesión…</p>
          : session ? <div className="space-y-3">
            <p role="alert" className="text-text-primary">{errorAcceso || 'La sesión actual no tiene un profesional habilitado.'}</p>
            <Link to="/cambiar-usuario" className="btn-primary inline-flex">Elegir usuario</Link>
          </div> : <>
            <fieldset disabled={loading} className="space-y-3">
              <legend className="text-lg font-semibold text-text-primary mb-3">¿Quién va a ingresar?</legend>
              {cargandoAccesos ? <p role="status" className="text-text-secondary">Cargando usuarios…</p>
                : accesos.length ? <div className="grid gap-3">
                  {accesos.map((acceso) => <button key={acceso.id} type="button"
                    aria-pressed={seleccionado?.id === acceso.id}
                    onClick={() => { setSeleccionado(acceso); setPassword(''); setError('') }}
                    className={'rounded-lg p-4 min-h-14 text-lg font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-primary ' +
                      (seleccionado?.id === acceso.id ? 'bg-accent-marino text-white border-accent-marino' : 'bg-surface text-text-primary border-border hover:bg-background')}>
                    {acceso.nombre}
                  </button>)}
                </div> : <p className="text-text-secondary">No hay usuarios habilitados para ingresar. Contactá al administrador.</p>}
              {seleccionado && <div className="space-y-2 pt-2">
                <label htmlFor="password" className="text-sm text-text-secondary">Contraseña de {seleccionado.nombre}</label>
                <input id="password" type="password" required autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} className="input" />
              </div>}
            </fieldset>
            {seleccionado && <button type="submit" disabled={loading || !password} className="btn-primary w-full">
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>}
          </>}
        {error && <p role="alert" className="text-text-primary">{error}</p>}
        {!cargandoAccesos && !accesos.length && <button type="button" className="btn-secondary"
          onClick={() => { setCargandoAccesos(true); setError(''); setIntento((v) => v + 1) }}>Reintentar</button>}

        <p className="text-sm text-text-secondary text-center">
          Usá tu cuenta personal. Si otra persona usa esta computadora, elegí “Cambiar usuario”.
        </p>
      </form>
    </div>
  )
}
