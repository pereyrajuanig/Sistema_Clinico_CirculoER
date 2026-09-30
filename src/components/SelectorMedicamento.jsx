import { useEffect, useRef, useState } from 'react'
import { formatearPresentacion, identificarMedicamento } from '@/lib/medicamentos'

function etiqueta(m) {
  const presentacion = formatearPresentacion(m)
  return identificarMedicamento(m) + (presentacion ? ` (${presentacion})` : '')
}

// Combobox con filtro por teclado — reemplaza un <select> nativo que se volvía largo e
// incómodo con catálogos grandes (pedido explícito del cliente: "se debería poder escribir
// e ir filtrando"). Sigue siendo un selector de UNA sola opción real (`value` es el
// medicamentoId) — escribir sin elegir un ítem de la lista no cuenta como selección válida,
// mismo criterio que un <select> nativo (no se puede "escribir" un value que no sea una de
// las opciones): quien use este componente debe seguir validando `value` antes de guardar,
// como ya hacía con el <select> viejo.
export default function SelectorMedicamento({ medicamentos, value, onChange, placeholder }) {
  const [query, setQuery] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [indiceActivo, setIndiceActivo] = useState(0)
  const inputRef = useRef(null)

  const seleccionado = medicamentos.find((m) => m.id === value) || null

  // Sincroniza el texto mostrado con el medicamento seleccionado cuando el desplegable
  // está cerrado (esa es la señal de "no se está escribiendo ahora mismo") — cubre tanto
  // una selección por click/teclado como un reset externo (`value` vuelve a '' al volver
  // de "+ Agregar medicamento nuevo" o al reiniciar el formulario tras guardar).
  useEffect(() => {
    if (!abierto) setQuery(seleccionado ? etiqueta(seleccionado) : '')
    // Solo interesa reaccionar a que cambie la selección o se cierre el desplegable, no a
    // que cambie la referencia del array `medicamentos` en cada render del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, abierto])

  const q = query.trim().toLowerCase()
  const filtrados =
    !q || (seleccionado && etiqueta(seleccionado).toLowerCase() === q)
      ? medicamentos
      : medicamentos.filter(
          (m) => m.nombre?.toLowerCase().includes(q) || m.droga?.toLowerCase().includes(q)
        )

  function elegir(m) {
    onChange(m.id)
    setQuery(etiqueta(m))
    setAbierto(false)
  }

  function handleKeyDown(e) {
    if (!abierto) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setAbierto(true)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndiceActivo((i) => Math.min(i + 1, filtrados.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndiceActivo((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      // Sin esto, Enter en este campo mandaría el formulario entero en vez de elegir
      // el ítem resaltado de la lista.
      e.preventDefault()
      if (filtrados[indiceActivo]) elegir(filtrados[indiceActivo])
    } else if (e.key === 'Escape') {
      setAbierto(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setIndiceActivo(0)
          setAbierto(true)
          if (value) onChange('') // escribir invalida la selección anterior
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="input"
        autoComplete="off"
      />

      {abierto && (
        <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-surface border border-border rounded-lg shadow-sm">
          {filtrados.length === 0 ? (
            <li className="px-3 py-2 text-base text-text-secondary">Sin resultados</li>
          ) : (
            filtrados.map((m, i) => (
              <li
                key={m.id}
                // onMouseDown (no onClick) + preventDefault: el mousedown corre ANTES del
                // blur del input, así que la selección se aplica sin que el input pierda
                // el foco a mitad de camino (bug clásico de combobox si se usa onClick).
                onMouseDown={(e) => {
                  e.preventDefault()
                  elegir(m)
                }}
                className={
                  'px-3 py-2 text-base cursor-pointer ' +
                  (i === indiceActivo
                    ? 'bg-background text-text-primary'
                    : 'text-text-primary hover:bg-background')
                }
              >
                {etiqueta(m)}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
