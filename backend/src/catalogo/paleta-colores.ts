// Paleta de colores por defecto para Áreas (PID: "cada área tenga un color
// específico"). Se asigna de forma determinística por id (rotando la
// paleta) cuando el área todavía no tiene un color elegido a mano; en
// cuanto un admin guarda un color propio (columna areas.color), ese valor
// gana siempre sobre el default.
export const PALETA_COLORES_AREA = [
  '#2563EB', // azul
  '#16A34A', // verde
  '#DC2626', // rojo
  '#D97706', // ámbar
  '#7C3AED', // violeta
  '#0891B2', // cian
  '#DB2777', // rosa
  '#65A30D', // lima
  '#EA580C', // naranja
  '#4F46E5', // índigo
];

export function colorPorDefecto(areaId: number): string {
  return PALETA_COLORES_AREA[areaId % PALETA_COLORES_AREA.length];
}

export function colorEfectivo(area: { id: number; color?: string | null }): string {
  return area.color || colorPorDefecto(area.id);
}
