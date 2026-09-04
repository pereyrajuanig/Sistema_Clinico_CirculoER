import { useTheme } from '@/lib/ThemeContext'

export default function ThemeToggle({ className = '' }) {
  const { tema, toggleTema } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTema}
      aria-label="Cambiar entre modo claro y oscuro"
      className={`inline-flex items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:text-text-primary hover:bg-border/50 focus:outline-none focus:ring-2 focus:ring-border ${className}`}
      style={{ width: 44, height: 44 }}
    >
      {tema === 'dark' ? <IconoSol /> : <IconoLuna />}
    </button>
  )
}

function IconoSol() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
      />
    </svg>
  )
}

function IconoLuna() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
