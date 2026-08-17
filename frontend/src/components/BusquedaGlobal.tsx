import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { busquedaApi, ResultadoBusqueda } from '../lib/api';

const VACIO: ResultadoBusqueda = { proyectos: [], tareas: [], comentarios: [] };

// Búsqueda global (tercera ronda de mejoras, ver README sección 4): una sola
// caja en el header que busca a la vez en proyectos, tareas y comentarios —
// el backend ya filtra todo por lo que el usuario actual puede ver, así que
// aquí solo hay que mostrar resultados y navegar al hacer clic.
export default function BusquedaGlobal() {
  const [termino, setTermino] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusqueda>(VACIO);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const texto = termino.trim();
    if (texto.length < 2) {
      setResultados(VACIO);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    // Debounce de 300ms — evita mandar una request por cada tecla mientras
    // el usuario todavía está escribiendo.
    const temporizador = setTimeout(() => {
      busquedaApi
        .buscar(texto)
        .then((r) => {
          setResultados(r);
          setAbierto(true);
        })
        .catch(() => setResultados(VACIO))
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(temporizador);
  }, [termino]);

  useEffect(() => {
    function alClickFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', alClickFuera);
    return () => document.removeEventListener('mousedown', alClickFuera);
  }, []);

  function irA(ruta: string) {
    setAbierto(false);
    setTermino('');
    navigate(ruta);
  }

  const hayResultados =
    resultados.proyectos.length > 0 || resultados.tareas.length > 0 || resultados.comentarios.length > 0;

  return (
    <div className="relative w-full max-w-xs" ref={contenedorRef}>
      <input
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
        onFocus={() => termino.trim().length >= 2 && setAbierto(true)}
        placeholder="Buscar proyectos, tareas, comentarios…"
        className="w-full bg-white/10 placeholder-primary-300 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:bg-white/20"
      />
      {abierto && termino.trim().length >= 2 && (
        <div className="absolute left-0 top-full mt-2 w-96 max-w-[90vw] bg-white rounded-xl shadow-card text-gray-900 z-50 overflow-hidden">
          <div className="max-h-96 overflow-auto">
            {buscando && <p className="text-sm text-gray-400 px-4 py-4 text-center">Buscando…</p>}
            {!buscando && !hayResultados && (
              <p className="text-sm text-gray-400 px-4 py-4 text-center">Sin resultados para "{termino}".</p>
            )}
            {!buscando && resultados.proyectos.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase text-gray-400 px-4 pt-3">Proyectos</p>
                {resultados.proyectos.map((p) => (
                  <button
                    key={`p-${p.id}`}
                    onClick={() => irA(`/proyectos/${p.id}`)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-primary-50/70 text-primary-800 font-semibold"
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
            )}
            {!buscando && resultados.tareas.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase text-gray-400 px-4 pt-3">Tareas</p>
                {resultados.tareas.map((t) => (
                  <button
                    key={`t-${t.id}`}
                    onClick={() => irA(`/proyectos/${t.proyectoId}`)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-primary-50/70"
                  >
                    <span className="text-gray-800">{t.nombre}</span>
                    <span className="text-gray-400"> — {t.proyectoNombre}</span>
                  </button>
                ))}
              </div>
            )}
            {!buscando && resultados.comentarios.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase text-gray-400 px-4 pt-3">Comentarios</p>
                {resultados.comentarios.map((c) => (
                  <button
                    key={`c-${c.id}`}
                    onClick={() => irA(`/proyectos/${c.proyectoId}`)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-primary-50/70"
                  >
                    <p className="text-gray-800 truncate">{c.texto}</p>
                    <p className="text-gray-400 text-xs">en "{c.tareaNombre}"</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
