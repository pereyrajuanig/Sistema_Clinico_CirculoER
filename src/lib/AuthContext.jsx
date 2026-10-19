import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const AuthContext = createContext(null)

const TIMEOUT_INACTIVIDAD_MS = 25 * 60 * 1000
const EVENTOS_ACTIVIDAD = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']

export function AuthProvider(props) {
  const [session, setSession] = useState(null)
  const [iniciando, setIniciando] = useState(true)
  const [identidad, setIdentidad] = useState({ usuarioId: null, profesional: null, error: '' })
  const usuarioActivo = useRef(null)

  useEffect(() => {
    let vigente = true
    let huboEvento = false
    // No consultar tablas dentro del callback de Auth: otro efecto resuelve el perfil.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nuevaSession) => {
      huboEvento = true
      if (vigente) {
        usuarioActivo.current = nuevaSession?.user?.id || null
        setSession(nuevaSession)
        if (!nuevaSession) setIdentidad({ usuarioId: null, profesional: null, error: '' })
        setIniciando(false)
      }
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (!vigente || huboEvento) return
      usuarioActivo.current = error ? null : data.session?.user?.id || null
      setSession(error ? null : data.session)
      setIniciando(false)
    }).catch(() => {
      if (vigente && !huboEvento) setIniciando(false)
    })
    return () => {
      vigente = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const usuarioId = session?.user?.id || null
  useEffect(() => {
    if (!usuarioId) return
    let vigente = true
    async function cargarProfesional() {
      try {
        const { data, error } = await supabase.rpc('identidad_profesional_actual').maybeSingle()
        if (!vigente) return
        setIdentidad({ usuarioId, profesional: error ? null : data,
          error: error ? 'No se pudo verificar tu acceso. Intentá ingresar nuevamente.'
            : data ? '' : 'Esta cuenta no tiene un profesional activo asignado. Elegí tu usuario para ingresar.' })
      } catch {
        if (vigente) setIdentidad({ usuarioId, profesional: null, error: 'No se pudo verificar tu acceso. Revisá la conexión e intentá nuevamente.' })
      }
    }
    cargarProfesional()
    return () => { vigente = false }
  }, [usuarioId])

  const profesional = usuarioId && identidad.usuarioId === usuarioId ? identidad.profesional : null
  const errorAcceso = usuarioId && identidad.usuarioId === usuarioId ? identidad.error : ''
  const loading = iniciando || Boolean(usuarioId && identidad.usuarioId !== usuarioId)
  const login = async (email, password) => {
    try {
      return await supabase.auth.signInWithPassword({ email, password })
    } catch {
      return { error: { message: 'No se pudo conectar. Intentá nuevamente.' } }
    }
  }
  // No revocar las sesiones de otras computadoras al salir de este navegador.
  const logout = useCallback(() => supabase.auth.signOut({ scope: 'local' }), [])

  async function cambiarPasswordInicial(password, passwordActual) {
    if (!usuarioId || usuarioActivo.current !== usuarioId) {
      return { error: { message: 'La sesión cambió. Volvé a ingresar.' } }
    }
    let passwordActualizada = false
    try {
      const { error } = await supabase.auth.updateUser({ password,
        ...(passwordActual ? { current_password: passwordActual } : {}) })
      if (error) {
        if (['current_password_required', 'current_password_invalid'].includes(error.code)) {
          return { requierePasswordActual: true, error: { message: 'Ingresá la contraseña provisoria para confirmar el cambio.' } }
        }
        const message = error.code === 'same_password' ? 'Elegí una contraseña distinta de la provisoria.'
          : error.code === 'weak_password' ? 'La contraseña no cumple los requisitos. Probá una más larga y difícil de adivinar.'
            : 'No se pudo confirmar el cambio. Intentá nuevamente o volvé a ingresar.'
        return { error: { message } }
      }
      passwordActualizada = true
      if (usuarioActivo.current !== usuarioId) return { passwordActualizada, error: { message: 'La sesión cambió. Volvé a ingresar.' } }
      // No habilitar el acceso basándose en un flag del navegador: comprobar el servidor.
      const { data, error: perfilError } = await supabase.rpc('identidad_profesional_actual').maybeSingle()
      if (usuarioActivo.current !== usuarioId) return { passwordActualizada, error: { message: 'La sesión cambió. Volvé a ingresar.' } }
      if (perfilError || !data || data.debe_cambiar_password !== false) {
        return { passwordActualizada, error: { message: 'La contraseña se actualizó, pero no se pudo confirmar el acceso. Volvé a ingresar con la contraseña nueva. Si continúa, contactá al administrador.' } }
      }
      setIdentidad({ usuarioId, profesional: data, error: '' })
      return { error: null }
    } catch {
      return { passwordActualizada, error: { message: 'No se pudo confirmar el cambio. Revisá la conexión. Si ya se aplicó, ingresá con la contraseña nueva.' } }
    }
  }

  useEffect(() => {
    if (!usuarioId) return

    let timer

    function reiniciarTimer() {
      clearTimeout(timer)
      timer = setTimeout(() => { logout().catch(() => {}) }, TIMEOUT_INACTIVIDAD_MS)
    }

    reiniciarTimer()
    EVENTOS_ACTIVIDAD.forEach((evento) => window.addEventListener(evento, reiniciarTimer))

    return () => {
      clearTimeout(timer)
      EVENTOS_ACTIVIDAD.forEach((evento) => window.removeEventListener(evento, reiniciarTimer))
    }
  }, [usuarioId, logout])

  const value = { session, profesional, loading, errorAcceso, login, logout, cambiarPasswordInicial }

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
