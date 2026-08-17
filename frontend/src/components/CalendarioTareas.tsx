import { useMemo, useState } from 'react';
import { Tarea } from '../lib/api';

// Vista de calendario (mejora sugerida, ver README sección 4) — el Gantt es
// potente pero intimidante para alguien que solo quiere ver "¿qué se vence
// esta semana?"; un calendario mensual es más amigable para ese uso, que es
// justo el público que se quiere alejar de MS Project.
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const PRIORIDAD_COLOR: Record<string, string> = {
  alta: 'bg-danger-500/15 text-danger-700',
  media: 'bg-accent-500/20 text-accent-800',
  baja: 'bg-gray-100 text-gray-600',
};

function aISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarioTareas({ tareas }: { tareas: Tarea[] }) {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth()); // 0-11
  const hoyIso = aISO(hoy);

  const celdas = useMemo(() => {
    const primerDiaMes = new Date(anio, mes, 1);
    // getDay(): 0=domingo..6=sábado — se convierte a offset donde 0=lunes.
    const offsetLunes = (primerDiaMes.getDay() + 6) % 7;
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();

    const dias: (Date | null)[] = [];
    for (let i = 0; i < offsetLunes; i++) dias.push(null);
    for (let d = 1; d <= diasEnMes; d++) dias.push(new Date(anio, mes, d));
    while (dias.length % 7 !== 0) dias.push(null);
    return dias;
  }, [anio, mes]);

  function tareasDelDia(d: Date): Tarea[] {
    const iso = aISO(d);
    return tareas.filter((t) => t.fechaInicio <= iso && t.fechaFin >= iso);
  }

  function irMesAnterior() {
    if (mes === 0) {
      setMes(11);
      setAnio((a) => a - 1);
    } else {
      setMes((m) => m - 1);
    }
  }

  function irMesSiguiente() {
    if (mes === 11) {
      setMes(0);
      setAnio((a) => a + 1);
    } else {
      setMes((m) => m + 1);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-card p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={irMesAnterior} className="text-primary-600 font-bold px-2 py-1 hover:bg-primary-50 rounded-lg">
          ← Anterior
        </button>
        <h3 className="font-display font-bold text-primary-900 capitalize">
          {MESES[mes]} {anio}
        </h3>
        <button onClick={irMesSiguiente} className="text-primary-600 font-bold px-2 py-1 hover:bg-primary-50 rounded-lg">
          Siguiente →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-400 mb-1">
        {DIAS_SEMANA.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((dia, i) => {
          if (!dia) return <div key={i} className="min-h-[90px] bg-gray-50 rounded-lg" />;
          const iso = aISO(dia);
          const tareasDia = tareasDelDia(dia);
          const esHoy = iso === hoyIso;
          return (
            <div
              key={i}
              className={`min-h-[90px] rounded-lg p-1.5 border ${
                esHoy ? 'border-primary-500 bg-primary-50' : 'border-gray-100'
              }`}
            >
              <span className={`text-xs font-bold ${esHoy ? 'text-primary-700' : 'text-gray-400'}`}>
                {dia.getDate()}
              </span>
              <div className="space-y-0.5 mt-1">
                {tareasDia.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    title={t.nombre}
                    className={`text-[10px] font-semibold px-1 py-0.5 rounded truncate ${
                      PRIORIDAD_COLOR[t.prioridad] ?? PRIORIDAD_COLOR.media
                    }`}
                  >
                    {t.nombre}
                  </div>
                ))}
                {tareasDia.length > 3 && (
                  <div className="text-[10px] text-gray-400 px-1">+{tareasDia.length - 3} más</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
