import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

export default function AvisoSalirConsulta({ pendiente, loading, borradorGuardado }) {
  const seguirRef = useRef(null)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => pendiente &&
    (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search))

  useEffect(() => {
    if (!pendiente) return
    function avisar(e) {
      e.preventDefault()
      e.returnValue = '' // El navegador elige el texto del aviso al cerrar/recargar.
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [pendiente])

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const focoAnterior = document.activeElement
    seguirRef.current?.focus()
    return () => {
      if (focoAnterior?.isConnected) focoAnterior.focus()
    }
  }, [blocker.state])

  if (blocker.state !== 'blocked') return null

  return (
    <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
      <div role="alertdialog" aria-modal="true" aria-labelledby="titulo-salir-consulta"
        aria-describedby="detalle-salir-consulta" onKeyDown={(e) => {
          if (e.key === 'Escape') blocker.reset()
          if (e.key === 'Tab') {
            const botones = Array.from(e.currentTarget.querySelectorAll('button:not(:disabled)'))
            const indice = botones.indexOf(document.activeElement)
            e.preventDefault()
            botones[(indice + (e.shiftKey ? -1 : 1) + botones.length) % botones.length]?.focus()
          }
        }} className="bg-surface border border-border rounded-lg p-6 w-full max-w-md space-y-4">
        <h2 id="titulo-salir-consulta" className="text-lg font-semibold text-text-primary">La consulta todavía no se registró</h2>
        <p id="detalle-salir-consulta" className="text-base text-text-primary">
          {loading ? 'Se está guardando la consulta. Esperá a que termine.' : borradorGuardado
            ? 'Podés seguir escribiendo o salir y continuar el borrador después desde esta computadora.'
            : 'No se pudo guardar el borrador. Si salís, podés perder lo que escribiste.'}
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" ref={seguirRef} onClick={() => blocker.reset()} className="btn-secondary">Seguir escribiendo</button>
          <button type="button" disabled={loading} onClick={() => blocker.proceed()} className="btn-secondary">
            {borradorGuardado ? 'Salir y conservar borrador' : 'Salir de todos modos'}
          </button>
        </div>
      </div>
    </div>
  )
}
