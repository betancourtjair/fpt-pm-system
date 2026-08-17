// Plantilla y parser de Excel para la carga masiva de usuarios (admin).
// Mismo criterio que ya se usó a mano para el catálogo inicial de 80
// personas (Catalogo_Usuarios_FPT.xlsx, no versionado en este repo por
// contener datos reales): hoja "Usuarios" para capturar, columnas con
// listas desplegables para Rol/Dirección/Área para evitar typos, y una
// fila de ejemplo que el parser ignora automáticamente.
import ExcelJS from 'exceljs';

const PRIMARY = 'FF561496';
const PRIMARY_DARK = 'FF2E0A4D';
const ACCENT = 'FFFFE600';
const EXAMPLE_FILL = 'FFEDE4F7';
const WHITE = 'FFFFFFFF';

export interface AreaConDireccion {
  nombre: string;
  direccionNombre: string;
}

export interface FilaUsuarioExcel {
  fila: number;
  nombre: string;
  email: string;
  rol: string;
  direccion: string;
  area: string;
  notas: string;
}

// Filas en blanco que se dejan listas con las validaciones (para que se
// pueda pegar/capturar un lote grande de una sola vez, igual que en la
// plantilla original de 80 personas).
const FILAS_EN_BLANCO = 200;

export async function generarPlantillaUsuariosExcel(
  direcciones: string[],
  areas: AreaConDireccion[],
  roles: { nombre: string; descripcion: string }[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Gestión de Proyectos — Fitness Para Todos';

  // ---------------------------------------------------------------------
  // Hoja 1: Instrucciones
  // ---------------------------------------------------------------------
  const wsI = wb.addWorksheet('Instrucciones', { views: [{ showGridLines: false }] });
  wsI.getColumn(1).width = 100;
  const tituloCelda = wsI.getCell('A1');
  tituloCelda.value = 'Sistema de Gestión de Proyectos — Fitness Para Todos';
  tituloCelda.font = { name: 'Arial', bold: true, size: 16, color: { argb: PRIMARY } };

  const subtituloCelda = wsI.getCell('A2');
  subtituloCelda.value = 'Plantilla para cargar usuarios al sistema';
  subtituloCelda.font = { name: 'Arial', bold: true, size: 13, color: { argb: '3D1166' } };

  const lineas = [
    '',
    'Llena únicamente la hoja "Usuarios". La fila 2 es un EJEMPLO — bórrala o sobrescríbela antes de subir el archivo (si la dejas tal cual, el sistema la ignora automáticamente porque su columna "Notas" dice "EJEMPLO").',
    '',
    'Qué llenar en cada columna:',
    '•  Nombre completo: nombre y apellido(s) del usuario. Texto libre.',
    '•  Correo electrónico: correo con el que iniciará sesión y recibirá notificaciones. No puede repetirse.',
    '•  Rol: elige de la lista desplegable — admin, director, gerente_area o colaborador (ver hoja Catálogo).',
    '•  Dirección: elige de la lista desplegable una de las Direcciones ya confirmadas en el sistema.',
    '•  Área: elige de la lista desplegable un Área que pertenezca a esa Dirección (revisa la hoja Catálogo si no estás seguro de la combinación correcta).',
    '•  Notas (opcional): cualquier aclaración.',
    '',
    'El rol "admin" tiene alcance global — no pertenece a ninguna Dirección/Área, así que puedes dejar esas dos columnas en blanco para ese caso (si las llenas de todos modos, el sistema las ignora).',
    '',
    'La contraseña de cada cuenta se genera automáticamente y de forma aleatoria — no se captura en este archivo. Al terminar la carga, el sistema te muestra una tabla con la contraseña temporal de cada usuario creado para que se la compartas de forma individual (nunca por correo grupal ni chat de equipo). Todas quedan marcadas para forzar el cambio de contraseña en el primer inicio de sesión.',
    '',
    'Si alguna fila tiene un error (correo repetido, Rol o combinación Dirección/Área que no existe, etc.) el sistema la salta y te dice cuál fue el problema — el resto de las filas válidas sí se cargan.',
  ];
  lineas.forEach((texto, i) => {
    const celda = wsI.getCell(`A${4 + i}`);
    celda.value = texto;
    celda.font = { name: 'Arial', size: 11, bold: texto.endsWith(':') };
    celda.alignment = { wrapText: true, vertical: 'top' };
    wsI.getRow(4 + i).height = texto.length > 90 ? 45 : 18;
  });

  // ---------------------------------------------------------------------
  // Hoja 2: Catálogo (referencia, no se edita)
  // ---------------------------------------------------------------------
  const wsC = wb.addWorksheet('Catálogo', { views: [{ showGridLines: false }] });
  wsC.getCell('A1').value = 'No editar esta hoja — es de referencia y alimenta las listas desplegables de la hoja Usuarios.';
  wsC.getCell('A1').font = { name: 'Arial', italic: true, size: 10, color: { argb: '6B7280' } };
  wsC.mergeCells('A1:C1');

  wsC.getCell('A3').value = 'Dirección → Área';
  wsC.getCell('A3').font = { name: 'Arial', bold: true, size: 12, color: { argb: PRIMARY } };
  wsC.getCell('A4').value = 'Dirección';
  wsC.getCell('B4').value = 'Área';
  [wsC.getCell('A4'), wsC.getCell('B4')].forEach((c) => {
    c.font = { name: 'Arial', bold: true, color: { argb: WHITE } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY } };
  });
  areas.forEach((a, i) => {
    wsC.getCell(`A${5 + i}`).value = a.direccionNombre;
    wsC.getCell(`B${5 + i}`).value = a.nombre;
  });
  wsC.getColumn(1).width = 26;
  wsC.getColumn(2).width = 26;

  const colRolInicio = 4;
  wsC.getCell(2, colRolInicio).value = 'Rol';
  wsC.getCell(2, colRolInicio + 1).value = 'Descripción del alcance';
  [wsC.getCell(2, colRolInicio), wsC.getCell(2, colRolInicio + 1)].forEach((c) => {
    c.font = { name: 'Arial', bold: true, color: { argb: WHITE } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY } };
  });
  roles.forEach((r, i) => {
    wsC.getCell(3 + i, colRolInicio).value = r.nombre;
    wsC.getCell(3 + i, colRolInicio + 1).value = r.descripcion;
  });
  wsC.getColumn(colRolInicio).width = 16;
  wsC.getColumn(colRolInicio + 1).width = 70;
  wsC.getColumn(colRolInicio + 1).alignment = { wrapText: true };

  // ---------------------------------------------------------------------
  // Hoja 3: Usuarios (la que se llena y se sube)
  // ---------------------------------------------------------------------
  const wsU = wb.addWorksheet('Usuarios', { views: [{ state: 'frozen', ySplit: 1 }] });
  const encabezados = ['Nombre completo', 'Correo electrónico', 'Rol', 'Dirección', 'Área', 'Notas (opcional)'];
  const headerRow = wsU.addRow(encabezados);
  headerRow.eachCell((c) => {
    c.font = { name: 'Arial', bold: true, color: { argb: WHITE } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_DARK } };
  });
  wsU.columns = [
    { width: 30 },
    { width: 32 },
    { width: 16 },
    { width: 20 },
    { width: 22 },
    { width: 36 },
  ];

  const filaEjemplo = wsU.addRow([
    'Ana Torres Medina',
    'ana.torres@fpt.com.mx',
    roles.find((r) => r.nombre !== 'admin')?.nombre ?? roles[0]?.nombre ?? '',
    areas[0]?.direccionNombre ?? '',
    areas[0]?.nombre ?? '',
    'EJEMPLO — borra o sobrescribe esta fila',
  ]);
  filaEjemplo.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXAMPLE_FILL } };
    c.font = { name: 'Arial', italic: true, color: { argb: '3D1166' } };
  });

  const listaRoles = `"${roles.map((r) => r.nombre).join(',')}"`;
  const listaDirecciones = `"${direcciones.join(',')}"`;
  const listaAreas = `"${Array.from(new Set(areas.map((a) => a.nombre))).join(',')}"`;

  for (let fila = 3; fila <= 2 + FILAS_EN_BLANCO; fila++) {
    wsU.getCell(`C${fila}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [listaRoles],
      showErrorMessage: true,
      errorTitle: 'Rol no válido',
      error: 'Elige un rol de la lista desplegable.',
    };
    wsU.getCell(`D${fila}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [listaDirecciones],
      showErrorMessage: true,
      errorTitle: 'Dirección no válida',
      error: 'Elige una Dirección de la lista desplegable.',
    };
    wsU.getCell(`E${fila}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [listaAreas],
      showErrorMessage: true,
      errorTitle: 'Área no válida',
      error: 'Elige un Área de la lista desplegable (revisa la hoja Catálogo para la combinación correcta con la Dirección).',
    };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Convierte cualquier valor de celda de ExcelJS (string, número, objeto de
// fórmula/richText, etc.) a un string simple y recortado.
function celdaATexto(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'object') {
    if ('text' in (valor as any)) return String((valor as any).text ?? '').trim();
    if ('result' in (valor as any)) return String((valor as any).result ?? '').trim();
    return '';
  }
  return String(valor).trim();
}

export async function parsearUsuariosExcel(buffer: Buffer): Promise<FilaUsuarioExcel[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws = wb.getWorksheet('Usuarios');
  if (!ws) {
    throw new Error('El archivo no tiene una hoja llamada "Usuarios" — usa la plantilla descargada desde el sistema.');
  }

  const filas: FilaUsuarioExcel[] = [];
  ws.eachRow((row, numeroFila) => {
    if (numeroFila === 1) return; // encabezado

    const nombre = celdaATexto(row.getCell(1).value);
    const email = celdaATexto(row.getCell(2).value);
    const rol = celdaATexto(row.getCell(3).value);
    const direccion = celdaATexto(row.getCell(4).value);
    const area = celdaATexto(row.getCell(5).value);
    const notas = celdaATexto(row.getCell(6).value);

    if (/EJEMPLO/i.test(notas)) return; // fila de ejemplo de la plantilla
    if (!nombre && !email && !rol && !direccion && !area) return; // fila en blanco

    filas.push({ fila: numeroFila, nombre, email, rol, direccion, area, notas });
  });

  return filas;
}
