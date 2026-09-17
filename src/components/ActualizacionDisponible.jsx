import { useRegisterSW } from 'virtual:pwa-register/react'

// Cada cuánto se chequea si hay una versión nueva mientras la pestaña sigue abierta, sin
// que nadie la recargue — ver el bloque de comentario sobre `onRegisteredSW` más abajo.
const INTERVALO_CHEQUEO_MS = 30 * 60 * 1000

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
  } = useRegisterSW({
    // Por defecto el navegador solo revisa si el service worker cambió cuando la página se
    // recarga o navega — si alguien deja la PWA abierta sin cerrarla nunca, el chequeo no
    // vuelve a correr solo y el banner de "hay una versión nueva" no aparece hasta que la
    // cierre y la vuelva a abrir. `onRegisteredSW` (no `onRegistered`, que está deprecado
    // en `vite-plugin-pwa`) da acceso al registration ya hecho para armar un chequeo
    // periódico manual — patrón oficial recomendado por la librería para este caso, con
    // los mismos resguardos que documenta ahí:
    onRegisteredSW(swUrl, registration) {
      if (!registration) return

      setInterval(async () => {
        // 1. Si ya hay una instalación en curso, no pisarla con otro chequeo
        if (registration.installing) return
        // 2. Sin conexión, ni intentarlo — el fetch de abajo fallaría igual, pero esto
        //    evita generar un error de red de más en la consola sin necesidad
        if (!navigator.onLine) return

        // 3. `cache: 'no-store'` (más los headers explícitos) para que el chequeo mismo
        //    no le pida al navegador una copia cacheada de sw.js — si no, podría creer que
        //    no cambió nada aunque el servidor ya tenga una versión nueva
        const respuesta = await fetch(swUrl, {
          cache: 'no-store',
          headers: {
            cache: 'no-store',
            'cache-control': 'no-cache',
          },
        })

        // 4. Recién si el archivo se pudo traer bien, le pedimos al browser que compare
        //    bytes con el service worker instalado — si difiere, dispara el mismo camino
        //    de siempre (`onNeedRefresh` → needRefresh → este banner), nunca se activa sola
        if (respuesta?.status === 200) {
          await registration.update()
        }
      }, INTERVALO_CHEQUEO_MS)
    },
  })

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
