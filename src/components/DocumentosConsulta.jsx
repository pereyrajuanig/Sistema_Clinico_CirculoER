import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function DocumentosConsulta({ consultaId, documentos, onUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFileChange(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    setError('')

    const path = `${consultaId}/${Date.now()}-${file.name}`

    const { error: uploadError } = await supabase.storage.from('documentos').upload(path, file)

    if (uploadError) {
      setUploading(false)
      setError(uploadError.message)
      return
    }

    const { data, error: insertError } = await supabase
      .from('documentos')
      .insert({ consulta_id: consultaId, url: path, nombre: file.name })
      .select()
      .single()

    setUploading(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    onUploaded(data)
  }

  async function handleVer(doc) {
    setError('')
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(doc.url, 60)

    if (error) {
      setError(error.message)
      return
    }

    window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="space-y-2 pt-2 border-t border-slate-100">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">Documentos adjuntos</span>
        <label className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer underline">
          {uploading ? 'Subiendo...' : '+ Adjuntar'}
          <input type="file" className="hidden" onChange={handleFileChange} disabled={uploading} />
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {documentos.length === 0 ? (
        <p className="text-xs text-slate-400">Sin documentos adjuntos.</p>
      ) : (
        <ul className="space-y-1">
          {documentos.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => handleVer(d)}
                className="text-xs text-slate-600 hover:text-slate-900 underline"
              >
                {d.nombre || 'Documento'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
