import { COLORES_RESALTADO } from '@/lib/resaltado'

// Selector de color de resaltado, compartido entre AntecedenteEntryForm.jsx y
// PatologiaEntryForm.jsx — opcional (no tiene "*"), a diferencia de los selectores de
// profesional. `value` es el string guardado en la base (uno de COLORES_RESALTADO, o null
// si no hay color puesto) — el primer círculo ("Sin color") lo vuelve a poner en null.
export default function SelectorColorResaltado({ value, onChange }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-text-secondary">Color (para resaltar, opcional)</label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Sin color"
          aria-label="Sin color"
          className={
            'w-9 h-9 rounded-full border-2 flex items-center justify-center text-text-secondary text-sm bg-surface ' +
            (value == null ? 'border-accent-marino' : 'border-border')
          }
        >
          ×
        </button>
        {COLORES_RESALTADO.map(({ valor, etiqueta, swatch }) => (
          <button
            key={valor}
            type="button"
            onClick={() => onChange(valor)}
            title={etiqueta}
            aria-label={etiqueta}
            className={
              `w-9 h-9 rounded-full border-2 ${swatch} ` +
              (value === valor ? 'border-accent-marino' : 'border-border')
            }
          />
        ))}
      </div>
    </div>
  )
}
