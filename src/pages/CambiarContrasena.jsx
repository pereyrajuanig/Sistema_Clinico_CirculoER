import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import logo from '@/assets/Logo-Circulo_FondoTransparente.png'

export default function CambiarContrasena() {
  const { session, profesional, loading, errorAcceso } = useAuth()
  if (loading) return <p role="status" className="p-6 text-text-primary">Verificando la sesión…</p>
  if (!session) return <Navigate to="/login" replace />
  if (!profesional) return <div className="p-6 space-y-4 text-text-primary">
    <p role="alert">{errorAcceso || 'No se pudo identificar al profesional.'}</p>
    <Link to="/cambiar-usuario" className="btn-primary inline-flex">Volver a elegir usuario</Link>
  </div>
  if (profesional.debe_cambiar_password === false) return <Navigate to="/" replace />
  return <FormularioPassword key={session.user.id} nombre={profesional.nombre} />
}

function FormularioPassword({ nombre }) {
  const { cambiarPasswordInicial } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [passwordActual, setPasswordActual] = useState('')
  const [pidePasswordActual, setPidePasswordActual] = useState(false)
  const [mostrar, setMostrar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar(e) {
    e.preventDefault()
    if (guardando) return
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (password !== confirmacion) { setError('Las contraseñas no coinciden.'); return }
    if (pidePasswordActual && !passwordActual) { setError('Ingresá la contraseña provisoria.'); return }
    setError('')
    setGuardando(true)
    try {
      const resultado = await (pidePasswordActual ? cambiarPasswordInicial(password, passwordActual) : cambiarPasswordInicial(password))
      if (resultado.requierePasswordActual) setPidePasswordActual(true)
      if (resultado.passwordActualizada || !resultado.error) { setPassword(''); setConfirmacion(''); setPasswordActual('') }
      if (resultado.error) setError(resultado.error.message)
    } catch {
      setError('No se pudo confirmar el cambio. Revisá la conexión e intentá nuevamente.')
    } finally {
      setGuardando(false)
    }
  }

  return <div className="min-h-screen bg-background flex items-center justify-center p-4">
    <form onSubmit={guardar} className="bg-surface border border-border rounded-lg shadow-sm p-6 sm:p-8 w-full max-w-lg space-y-5">
      <img src={logo} alt="Círculo Policía" className="h-28 mx-auto" />
      <h1 className="text-2xl font-bold text-text-primary">Elegí tu contraseña</h1>
      <p className="text-text-primary">Hola, <strong>{nombre}</strong>. Antes de ingresar por primera vez, reemplazá la contraseña provisoria por una que conozcas solo vos.</p>
      <fieldset disabled={guardando} className="space-y-4">
        {pidePasswordActual && <div className="space-y-2">
          <label htmlFor="password-provisoria" className="text-text-primary">Contraseña provisoria</label>
          <input id="password-provisoria" type={mostrar ? 'text' : 'password'} autoComplete="current-password" required
            value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} className="input" />
        </div>}
        <div className="space-y-2">
          <label htmlFor="nueva-password" className="text-text-primary">Contraseña nueva</label>
          <input id="nueva-password" type={mostrar ? 'text' : 'password'} autoComplete="new-password" required minLength={8}
            value={password} onChange={(e) => setPassword(e.target.value)} className="input" aria-describedby="requisito-password" />
          <p id="requisito-password" className="text-sm text-text-secondary">Usá al menos 8 caracteres. Podés elegir una frase fácil de recordar.</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="confirmar-password" className="text-text-primary">Repetí la contraseña nueva</label>
          <input id="confirmar-password" type={mostrar ? 'text' : 'password'} autoComplete="new-password" required minLength={8}
            value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} className="input" />
        </div>
        <label className="flex items-center gap-3 min-h-11 text-text-primary cursor-pointer">
          <input type="checkbox" checked={mostrar} onChange={(e) => setMostrar(e.target.checked)} className="h-5 w-5" />Mostrar contraseñas
        </label>
      </fieldset>
      {error && <p role="alert" className="text-text-primary">{error}</p>}
      <button type="submit" disabled={guardando} className="btn-primary w-full">{guardando ? 'Guardando…' : 'Guardar contraseña e ingresar'}</button>
      {!guardando && <Link to="/cambiar-usuario" className="btn-secondary w-full inline-flex justify-center">Volver a elegir usuario</Link>}
    </form>
  </div>
}
