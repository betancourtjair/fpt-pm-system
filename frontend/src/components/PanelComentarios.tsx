import { FormEvent, useEffect, useRef, useState } from 'react';
import { actividadApi, comentariosApi, proyectosApi, ItemActividad, MiembroEquipo, getUsuario } from '../lib/api';

// Detecta si el texto justo antes del cursor es un @mention a medio
// escribir (sin espacios de por medio) — se usa para decidir si se muestra
// el picker y qué fragmento reemplazar al elegir una sugerencia.
const REGEX_MENCION = /@[a-zA-Z0-9À-ÿ]*$/;

// Comentarios + bitácora de actividad por tarea (mejora sugerida: colaborar
// dentro de la herramienta sin salirse a correo/WhatsApp, y ver de un
// vistazo qué cambió y cuándo). Borrar un comentario exige ser quien lo
// escribió o poder administrar el proyecto — el backend es quien realmente
// lo hace cumplir, aquí solo se oculta el botón; los eventos de sistema
// nunca se pueden borrar desde aquí.
export default function PanelComentarios({
  tareaId,
  proyectoId,
  puedeGestionar,
}: {
  tareaId: number;
  proyectoId: number;
  puedeGestionar: boolean;
}) {
  const usuario = getUsuario();
  const [items, setItems] = useState<ItemActividad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cargarActividad() {
    return actividadApi
      .deTarea(tareaId)
      .then(setItems)
      .catch(() => setError('No se pudo cargar la actividad de la tarea.'));
  }

  // Equipo del proyecto, para ofrecer sugerencias de @mención al escribir.
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  const [mencionAbierta, setMencionAbierta] = useState(false);
  const [fragmentoMencion, setFragmentoMencion] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const mencionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cargarActividad().finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tareaId]);

  useEffect(() => {
    proyectosApi
      .equipo(proyectoId)
      .then(setEquipo)
      .catch(() => {
        // Silencioso: si falla, simplemente no hay sugerencias de mención.
      });
  }, [proyectoId]);

  // Cerrar el picker de menciones al hacer click fuera de él.
  useEffect(() => {
    function alClickFuera(e: MouseEvent) {
      if (mencionRef.current && !mencionRef.current.contains(e.target as Node)) {
        setMencionAbierta(false);
      }
    }
    document.addEventListener('mousedown', alClickFuera);
    return () => document.removeEventListener('mousedown', alClickFuera);
  }, []);

  const sugerencias = mencionAbierta
    ? equipo.filter((m) => m.nombre.toLowerCase().includes(fragmentoMencion.toLowerCase()))
    : [];

  function alCambiarTexto(e: React.ChangeEvent<HTMLInputElement>) {
    const valor = e.target.value;
    setTexto(valor);
    const cursor = e.target.selectionStart ?? valor.length;
    const antesDelCursor = valor.slice(0, cursor);
    const match = antesDelCursor.match(REGEX_MENCION);
    if (match) {
      setFragmentoMencion(match[0].slice(1));
      setMencionAbierta(true);
    } else {
      setMencionAbierta(false);
    }
  }

  function elegirMencion(m: MiembroEquipo) {
    const input = inputRef.current;
    const cursor = input?.selectionStart ?? texto.length;
    const antesDelCursor = texto.slice(0, cursor);
    const despuesDelCursor = texto.slice(cursor);
    const inicioMencion = antesDelCursor.replace(REGEX_MENCION, '');
    const token = `@${m.nombre.replace(/\s+/g, '')}`;
    const nuevoTexto = `${inicioMencion}${token} ${despuesDelCursor}`;
    setTexto(nuevoTexto);
    setMencionAbierta(false);
    // Recolocar el cursor justo después del token insertado.
    const nuevaPosicion = inicioMencion.length + token.length + 1;
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(nuevaPosicion, nuevaPosicion);
    });
  }

  function alPresionarTecla(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!mencionAbierta) return;
    if (e.key === 'Escape') {
      setMencionAbierta(false);
      return;
    }
    if ((e.key === 'Enter' || e.key === 'Tab') && sugerencias.length > 0) {
      e.preventDefault();
      elegirMencion(sugerencias[0]);
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;
    setError(null);
    setEnviando(true);
    try {
      await comentariosApi.crear(tareaId, limpio);
      setTexto('');
      await cargarActividad();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo publicar el comentario.');
    } finally {
      setEnviando(false);
    }
  }

  async function eliminar(item: ItemActividad) {
    if (!item.comentarioId) return;
    if (!confirm('¿Eliminar este comentario?')) return;
    try {
      await comentariosApi.eliminar(item.comentarioId);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo eliminar el comentario.');
    }
  }

  if (cargando) return <p className="text-xs text-gray-400">Cargando actividad…</p>;

  return (
    <div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 mb-2">Todavía no hay actividad en esta tarea.</p>
      ) : (
        <ul className="mb-2 divide-y divide-gray-50 max-h-56 overflow-y-auto">
          {items.map((item) => {
            if (item.tipo !== 'comentario') {
              // Evento de sistema (creación / cambio de estatus, responsable
              // o prioridad) — informativo, nunca editable ni borrable aquí.
              return (
                <li key={item.id} className="py-1.5 text-xs">
                  <p className="text-gray-400 italic">
                    <span className="font-semibold text-gray-500">{item.usuario?.nombre ?? 'Sistema'}</span>{' '}
                    {item.detalle}{' '}
                    <span className="text-gray-300">
                      · {new Date(item.creadoEn).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </p>
                </li>
              );
            }
            const puedeBorrar = puedeGestionar || item.usuario?.id === usuario?.id;
            return (
              <li key={item.id} className="py-1.5 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-gray-700">{item.usuario?.nombre ?? '—'}</span>{' '}
                    <span className="text-gray-400">
                      {new Date(item.creadoEn).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                    <p className="text-gray-600 whitespace-pre-wrap break-words">{item.detalle}</p>
                  </div>
                  {puedeBorrar && (
                    <button
                      onClick={() => eliminar(item)}
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
        <div className="relative flex-1" ref={mencionRef}>
          <input
            ref={inputRef}
            type="text"
            value={texto}
            onChange={alCambiarTexto}
            onKeyDown={alPresionarTecla}
            placeholder="Escribe un comentario… usa @ para mencionar"
            maxLength={4000}
            disabled={enviando}
            className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs"
          />
          {mencionAbierta && sugerencias.length > 0 && (
            <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-xl shadow-card text-gray-900 z-50 overflow-hidden max-h-40 overflow-y-auto">
              {sugerencias.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => elegirMencion(m)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-primary-50/50"
                >
                  {m.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
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
