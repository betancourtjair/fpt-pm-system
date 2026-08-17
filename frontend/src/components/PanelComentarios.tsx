import { FormEvent, useEffect, useState } from 'react';
import { comentariosApi, ComentarioTarea, getUsuario } from '../lib/api';

// Comentarios por tarea (mejora sugerida: colaborar dentro de la
// herramienta sin salirse a correo/WhatsApp). Borrar exige ser quien lo
// escribió o poder administrar el proyecto — el backend es quien realmente
// lo hace cumplir, aquí solo se oculta el botón.
export default function PanelComentarios({ tareaId, puedeGestionar }: { tareaId: number; puedeGestionar: boolean }) {
  const usuario = getUsuario();
  const [comentarios, setComentarios] = useState<ComentarioTarea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    comentariosApi
      .deTarea(tareaId)
      .then(setComentarios)
      .catch(() => setError('No se pudieron cargar los comentarios.'))
      .finally(() => setCargando(false));
  }, [tareaId]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;
    setError(null);
    setEnviando(true);
    try {
      const actualizados = await comentariosApi.crear(tareaId, limpio);
      setComentarios(actualizados);
      setTexto('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo publicar el comentario.');
    } finally {
      setEnviando(false);
    }
  }

  async function eliminar(c: ComentarioTarea) {
    if (!confirm('¿Eliminar este comentario?')) return;
    try {
      await comentariosApi.eliminar(c.id);
      setComentarios((prev) => prev.filter((x) => x.id !== c.id));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo eliminar el comentario.');
    }
  }

  if (cargando) return <p className="text-xs text-gray-400">Cargando comentarios…</p>;

  return (
    <div>
      {comentarios.length === 0 ? (
        <p className="text-xs text-gray-400 mb-2">Todavía no hay comentarios.</p>
      ) : (
        <ul className="mb-2 divide-y divide-gray-50 max-h-56 overflow-y-auto">
          {comentarios.map((c) => {
            const puedeBorrar = puedeGestionar || c.usuario?.id === usuario?.id;
            return (
              <li key={c.id} className="py-1.5 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-gray-700">{c.usuario?.nombre ?? '—'}</span>{' '}
                    <span className="text-gray-400">
                      {new Date(c.creadoEn).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                    <p className="text-gray-600 whitespace-pre-wrap break-words">{c.texto}</p>
                  </div>
                  {puedeBorrar && (
                    <button
                      onClick={() => eliminar(c)}
                      className="text-danger-500 font-bold hover:underline shrink-0"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="text-danger-500 text-xs font-medium mb-2">{error}</p>}
      <form onSubmit={enviar} className="flex gap-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe un comentario…"
          maxLength={4000}
          disabled={enviando}
          className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs"
        />
        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          className="text-xs font-bold text-primary-600 hover:text-primary-800 disabled:text-gray-300"
        >
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}
