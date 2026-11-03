import { useState } from 'react'
import { eliminarBorradorConsulta, leerBorradorConsulta, recuperarBorradorAnterior } from '@/lib/borradorConsulta'
import { useAuth } from '@/lib/AuthContext'

// Se monta de nuevo al cerrar el formulario para leer el último borrador conservado.
export default function AbrirNuevaConsulta({ pacienteId, onOpen }) {
  const { profesional } = useAuth()
  const profesionalId = profesional?.id
  const [borrador, setBorrador] = useState(() => leerBorradorConsulta(pacienteId, profesionalId))
  const [anterior] = useState(() => leerBorradorConsulta(pacienteId))
  const [error, setError] = useState('')

  function descartar() {
    const detalle = borrador.medicacionRegistrada
      ? ' La medicación habitual que ya se registró se conserva.' : ''
    if (!window.confirm(`¿Descartar el borrador de esta consulta? El texto sin registrar se perderá.${detalle}`)) return
    if (!eliminarBorradorConsulta(pacienteId, profesionalId)) {
      setError('No se pudo descartar el borrador en este navegador. Intentá nuevamente.')
      return
    }
    setBorrador(null)
  }

  if (!borrador) return <div className="space-y-3">
    <button onClick={onOpen} className="btn-primary">+ Nueva consulta</button>
    {anterior && !anterior.profesionalId && <div className="space-y-2">
      <p className="text-sm text-text-secondary">Hay un borrador anterior sin profesional asignado en esta computadora.</p>
      <button className="btn-secondary" onClick={() => {
        if (!window.confirm(`¿Recuperar ese borrador como ${profesional.nombre}? Revisá su contenido antes de registrarlo.`)) return
        if (recuperarBorradorAnterior(pacienteId, profesionalId)) setBorrador(leerBorradorConsulta(pacienteId, profesionalId))
        else setError('No se pudo recuperar el borrador. Intentá nuevamente.')
      }}>Recuperar borrador anterior</button>
    </div>}
    {error && <p role="alert" className="text-text-primary">{error}</p>}
  </div>

  return (
    <div className="border border-primary rounded-lg bg-primary/10 p-4 space-y-3">
      <p className="text-base font-semibold text-text-primary">Tenés una consulta sin terminar</p>
      <p className="text-base text-text-secondary">El borrador está guardado en esta computadora y todavía no forma parte de la historia clínica.</p>
      <div className="flex flex-wrap gap-3">
        <button onClick={onOpen} className="btn-primary">Continuar consulta</button>
        <button onClick={descartar} className="btn-secondary">Descartar borrador</button>
      </div>
      {error && <p role="alert" className="text-base text-text-primary">{error}</p>}
    </div>
  )
}
