import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

function temaInicial() {
  const guardado = localStorage.getItem('tema')
  if (guardado === 'light' || guardado === 'dark') return guardado
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider(props) {
  const [tema, setTema] = useState(temaInicial)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema)
    localStorage.setItem('tema', tema)
  }, [tema])

  function toggleTema() {
    setTema((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ tema, toggleTema }}>{props.children}</ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
