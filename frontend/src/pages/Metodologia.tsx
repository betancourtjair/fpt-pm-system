import Layout from '../components/Layout';

// Guía de metodología: cómo gestionar un proyecto de punta a punta usando
// esta herramienta, desde la junta de arranque hasta el cierre. No es
// documentación técnica (eso vive en el PID) — es la guía de uso pensada
// para quien va a crear y dar seguimiento a un proyecto real.
function Paso({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-6 mb-5">
      <div className="flex items-start gap-4">
        <span className="flex-shrink-0 w-9 h-9 rounded-full bg-primary-700 text-white font-display font-extrabold flex items-center justify-center">
          {numero}
        </span>
        <div className="flex-1">
          <h2 className="font-display font-bold text-lg text-primary-900 mb-2">{titulo}</h2>
          <div className="text-sm text-gray-700 leading-relaxed space-y-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function Metodologia() {
  return (
    <Layout activo="metodologia">
      <div className="mb-6">
        <h1 className="font-display font-extrabold text-2xl text-primary-900">
          Metodología: cómo gestionar un proyecto con esta herramienta
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Guía práctica desde la junta de arranque hasta el cierre — pensada para quien va a crear
          y dar seguimiento a un proyecto real en el sistema.
        </p>
      </div>

      <Paso numero={1} titulo="Antes de capturar nada: la junta de arranque (Kick-off)">
        <p>
          Todo proyecto empieza con una junta de arranque, no con la pantalla de "Nuevo proyecto".
          El objetivo de esta junta es dejar claro, con las personas correctas en la sala, qué se
          va a hacer, quién participa y con qué límites de tiempo y presupuesto — para que capturar
          el proyecto en el sistema después sea un trámite de 5 minutos y no una negociación.
        </p>
        <p className="font-semibold text-primary-800">¿Quién debe estar?</p>
        <p>
          El responsable del proyecto (quien quedará como Responsable en el sistema), un
          representante de cada Área que se va a involucrar, y su Director o gerente_area si el
          proyecto compromete presupuesto o recursos de esa Área.
        </p>
        <p className="font-semibold text-primary-800">¿Qué debe quedar definido al salir de la junta?</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Nombre del proyecto y objetivo en una frase.</li>
          <li>Fecha de inicio y fecha de fin (el compromiso real, no la fecha optimista).</li>
          <li>Presupuesto autorizado.</li>
          <li>Qué Áreas están involucradas (esto define quién puede ver el proyecto en el sistema).</li>
          <li>Quién es el Responsable del proyecto.</li>
          <li>
            Un primer desglose de las tareas grandes (no hace falta el detalle fino todavía — eso
            se afina en el Paso 3).
          </li>
        </ul>
      </Paso>

      <Paso numero={2} titulo='Crear el proyecto: "Proyectos" → "+ Nuevo proyecto"'>
        <p>
          Con lo definido en la junta, entra a la pestaña <strong>Proyectos</strong> y da clic en{' '}
          <strong>+ Nuevo proyecto</strong>. Vas a capturar: nombre, fecha de inicio, fecha de fin,
          presupuesto (opcional — no todo proyecto lo lleva desde el arranque), responsable y las
          Áreas involucradas.
        </p>
        <p>
          Las Áreas involucradas son la pieza más importante de este paso: definen quién puede ver
          el proyecto. Un usuario solo ve los proyectos donde su Área está marcada como
          involucrada (o si es admin/director de una Dirección que las abarca) — si olvidas marcar
          un Área, las personas de esa Área simplemente no van a ver el proyecto en su pantalla.
        </p>
        <p className="text-xs text-gray-500 italic">
          Quién puede crear proyectos: admin (cualquiera), director (dentro de su Dirección),
          gerente_area (dentro de su Área) y colaborador (también dentro de su propia Área).
        </p>
      </Paso>

      <Paso numero={3} titulo='Desglosar el proyecto en tareas: entra al proyecto → "+ Nueva tarea"'>
        <p>
          Da clic en el proyecto recién creado para entrar a su detalle, y ahí registra cada tarea
          del desglose que salió de la junta de arranque. Por cada tarea vas a definir: nombre,
          fecha de inicio, fecha de fin, presupuesto (opcional), responsable, a qué tarea depende
          (opcional) y qué usuarios quedan asignados como colaboradores.
        </p>
        <p className="font-semibold text-primary-800">Buenas prácticas al capturar una tarea:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Que tenga un entregable verificable — "Diseñar el layout de la sucursal" es una tarea;
            "Avanzar en el proyecto" no lo es.
          </li>
          <li>Fechas realistas, no las que "se oyen bien" en la junta.</li>
          <li>
            Un responsable claro por tarea (puede haber varios colaboradores asignados, pero un
            solo responsable que rinde cuentas de esa tarea).
          </li>
          <li>
            Si una tarea no puede empezar hasta que otra termine, regístralo en "Depende de" — esto
            alimenta directamente el Diagrama de Gantt del Paso 4.
          </li>
        </ul>
      </Paso>

      <Paso numero={4} titulo='Dar seguimiento con el "Diagrama de Gantt"'>
        <p>
          La pestaña <strong>Diagrama de Gantt</strong> dibuja automáticamente todas las tareas de
          un proyecto en la línea de tiempo, con sus dependencias. Se actualiza en vivo en cuanto
          alguien registra avance o cambia una fecha (mientras tengas la pantalla abierta), y como
          respaldo se refresca solo cada 2 minutos por si la conexión en vivo se cae.
        </p>
        <p>
          Cada colaborador asignado debe entrar periódicamente a actualizar el estatus y el
          porcentaje de avance de sus propias tareas — el Gantt es tan útil como actualizada esté
          la información que alimenta.
        </p>
        <p>
          Desde ahí también puedes exportar el Gantt a PDF cuando necesites compartir el avance
          fuera del sistema (por ejemplo, para una junta de seguimiento con Dirección General).
        </p>
      </Paso>

      <Paso numero={5} titulo="Notificaciones: correo y la campanita dentro del sistema">
        <p>
          No hace falta perseguir a nadie para avisarle que le tocó una tarea. En cuanto se asigna
          una tarea, el sistema manda un correo automático al responsable y a los colaboradores. Si
          la fecha límite se acerca, manda un recordatorio automático 48 y 24 horas antes de que
          venza.
        </p>
        <p>
          Esas mismas notificaciones también aparecen en la campanita del encabezado, en tiempo
          real, sin necesidad de recargar la página — útil si en ese momento no estás revisando tu
          correo.
        </p>
      </Paso>

      <Paso numero={6} titulo="Cerrar el proyecto">
        <p>
          Un proyecto se da por cerrado cuando todas sus tareas quedan en estatus "Completada". No
          hay un botón especial de "cerrar proyecto" — el cierre es, simplemente, que el Gantt
          muestre el 100% del avance. Aprovecha ese momento para una junta breve de cierre con las
          mismas personas de la junta de arranque: qué salió bien, qué tomó más tiempo del
          estimado y qué ajustar para el siguiente proyecto.
        </p>
      </Paso>

      <div className="bg-primary-950 text-white rounded-2xl shadow-card p-6">
        <h2 className="font-display font-bold text-base mb-3">Quién ve y hace qué (resumen rápido)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-bold text-accent-500">admin</p>
            <p className="text-primary-200">
              Alcance global: gestiona usuarios, catálogo, proyectos y tareas de toda la empresa.
              No se asigna como responsable ni colaborador operativo de proyectos/tareas — es un
              rol de respaldo administrativo, no de ejecución.
            </p>
          </div>
          <div>
            <p className="font-bold text-accent-500">director</p>
            <p className="text-primary-200">
              Ve y gestiona todos los proyectos y tareas de su Dirección completa, incluido el
              presupuesto.
            </p>
          </div>
          <div>
            <p className="font-bold text-accent-500">gerente_area</p>
            <p className="text-primary-200">
              Ve y gestiona los proyectos y tareas donde su Área está involucrada. Ve presupuesto
              solo si su Director (o un admin) se lo autoriza explícitamente.
            </p>
          </div>
          <div>
            <p className="font-bold text-accent-500">colaborador</p>
            <p className="text-primary-200">
              Ve y actualiza el avance únicamente de las tareas donde es responsable o está
              asignado como colaborador. También puede crear proyectos dentro de su propia Área.
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-6 text-center">
        ¿Algo no cuadra con esta guía o tienes dudas de un caso concreto? Escríbenos a{' '}
        <a href="mailto:soporte@fpt.com.mx" className="text-primary-600 font-semibold hover:underline">
          soporte@fpt.com.mx
        </a>
        .
      </p>
    </Layout>
  );
}
