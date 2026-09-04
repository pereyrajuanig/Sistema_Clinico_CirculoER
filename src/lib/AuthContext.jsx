import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const AuthContext = createContext(null)

const TIMEOUT_INACTIVIDAD_MS = 45 * 60 * 1000
const EVENTOS_ACTIVIDAD = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']

export function AuthProvider(props) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Al montar, revisa si ya hay una sesión guardada en esta computadora
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Se mantiene sincronizado si la sesión cambia (login, logout, refresh de token)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const login = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const logout = () => supabase.auth.signOut()

  useEffect(() => {
    if (!session) return

    let timer

    function reiniciarTimer() {
      clearTimeout(timer)
      timer = setTimeout(logout, TIMEOUT_INACTIVIDAD_MS)
    }

    reiniciarTimer()
    EVENTOS_ACTIVIDAD.forEach((evento) => window.addEventListener(evento, reiniciarTimer))

    return () => {
      clearTimeout(timer)
      EVENTOS_ACTIVIDAD.forEach((evento) => window.removeEventListener(evento, reiniciarTimer))
    }
  }, [session])

  const value = { session, loading, login, logout }

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
