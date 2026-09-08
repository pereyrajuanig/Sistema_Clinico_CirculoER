import { useState } from 'react'
import { Link } from 'react-router-dom'
import ThemeToggle from '@/components/ThemeToggle'
import logo from '@/assets/Logo-Circulo_FondoTransparente.png'

// Header compartido por todas las pantallas. Por debajo de lg (1024px) — cualquier celular
// o tablet en cualquier orientación — todas las acciones (el link destacado junto al
// título, los botones de la derecha) se colapsan en un menú desplegable: con varias
// pantallas teniendo 3-4 acciones distintas en el header, tratar de que entren todas en
// una sola fila a cualquier ancho es frágil (es justamente el bug que se reportó). lg es un
// límite conservador a propósito — recién ahí se puede asumir con confianza que hay lugar
// de sobra para todo en una fila, que es lo que importa para las 2 computadoras de
// escritorio del consultorio (uso principal).
function claseAccion(variant) {
  if (variant === 'accent') {
    return 'rounded-lg px-3 py-1.5 text-base font-semibold transition-colors border bg-primary text-accent-marino border-accent-marino hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 min-h-11 inline-flex items-center justify-center'
  }
  if (variant === 'alert') {
    return 'rounded-lg px-3 py-1.5 text-base font-semibold transition-colors border bg-alert/10 text-text-primary border-alert hover:bg-alert/20 focus:outline-none focus:ring-2 focus:ring-alert focus:ring-offset-1 min-h-11 inline-flex items-center justify-center'
  }
  return 'btn-secondary px-3 py-1.5 inline-flex items-center justify-center'
}

function Accion({ accion, extraClass = '', onNavigate }) {
  const clase = `${claseAccion(accion.variant)} ${extraClass}`

  function handleClick(e) {
    accion.onClick?.(e)
    onNavigate?.()
  }

  if (accion.to) {
    return (
      <Link to={accion.to} onClick={handleClick} className={clase}>
        {accion.label}
      </Link>
    )
  }

  return (
    <button type="button" onClick={handleClick} className={clase}>
      {accion.label}
    </button>
  )
}

// navLink: { label, to, variant: 'accent' } — el link destacado que va pegado al título
// (ej. "Medicamentos" en Pacientes, "Historial de movimientos" en Medicamentos)
// actions: [{ label, to?, onClick?, variant? }] — el resto de los botones del header
export default function Header({ title, subtitle, navLink, actions = [] }) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const todasLasAcciones = navLink ? [navLink, ...actions] : actions

  return (
    <header className="bg-surface border-b border-border">
      <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img src={logo} alt="" className="h-12 w-12 lg:h-20 lg:w-20 object-contain shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl lg:text-4xl font-bold text-text-primary truncate">{title}</h1>
            {subtitle}
          </div>
          {navLink && (
            <>
              <div className="hidden lg:block h-10 w-px bg-border mx-1 shrink-0" />
              <div className="hidden lg:block shrink-0">
                <Accion accion={navLink} />
              </div>
            </>
          )}
        </div>

        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <ThemeToggle />
          {actions.map((accion) => (
            <Accion key={accion.label} accion={accion} />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuAbierto}
          className="lg:hidden inline-flex items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:text-text-primary hover:bg-border/50 focus:outline-none focus:ring-2 focus:ring-border shrink-0"
          style={{ width: 44, height: 44 }}
        >
          {menuAbierto ? <IconoCerrar /> : <IconoMenu />}
        </button>
      </div>

      {menuAbierto && (
        <div className="lg:hidden border-t border-border px-4 sm:px-6 py-3 space-y-2">
          <ThemeToggle />
          {todasLasAcciones.map((accion) => (
            <Accion
              key={accion.label}
              accion={accion}
              extraClass="w-full"
              onNavigate={() => setMenuAbierto(false)}
            />
          ))}
        </div>
      )}
    </header>
  )
}

function IconoMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function IconoCerrar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
