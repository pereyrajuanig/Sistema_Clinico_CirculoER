import { useRegisterSW } from 'virtual:pwa-register/react'

// Contraparte de registerType: 'prompt' en vite.config.js (ver ese archivo y la sección
// PWA de CLAUDE.md) — cuando el service worker detecta una versión nueva del build, NO se
// activa solo: `needRefresh` pasa a true y este banner queda mostrado hasta que el usuario
// decide tocar "Actualizar", momento en el que recién se activa la versión nueva y se
// recarga la página. Nunca recarga sin que el usuario lo pida.
//
// Montado una sola vez en App.jsx, fuera de las rutas — el estado de "hay una versión
// nueva" no depende de en qué pantalla está el usuario.
export default function ActualizacionDisponible() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 sm:w-full sm:max-w-sm">
      <div className="bg-surface border border-primary rounded-lg shadow-sm p-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-base text-text-primary">Hay una versión nueva disponible.</p>
        {/*
          btn-secondary, no btn-primary a propósito: RNF-01 (design-system.md/CLAUDE.md)
          limita a un solo botón primario visible POR PANTALLA, y este banner puede
          aparecer flotando sobre cualquier pantalla — incluidas las que ya tienen su
          propio primario (ej. "+ Nueva consulta" en la ficha del paciente). Usar
          btn-primary acá competiría con ese botón en vez de sumar una segunda acción
          principal a la vista.
        */}
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="btn-secondary px-3 py-1.5 shrink-0"
        >
          Actualizar
        </button>
      </div>
    </div>
  )
}
