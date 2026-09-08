import { supabase } from '@/lib/supabaseClient'

// Registra una edición o baja de un registro clínico (consultas, antecedentes,
// resultados_laboratorio) con el estado ANTERIOR completo, para poder reconstruir qué decía
// el registro antes del cambio — eliminado_en/eliminado_por dicen cuándo y quién, pero no
// qué valores tenía. La tabla `auditoria` solo permite insert/select por RLS, nunca
// update/delete: es un libro contable, igual criterio que `movimientos_stock`.
export function registrarAuditoria({ tabla, registroId, accion, usuarioId, valoresAnteriores }) {
  return supabase.from('auditoria').insert({
    tabla,
    registro_id: registroId,
    accion,
    usuario_id: usuarioId,
    valores_anteriores: valoresAnteriores,
  })
}
