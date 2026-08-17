// Plantillas HTML de las alertas por correo (Fase 2, PID sección 7).
// Paleta de marca (PID sección 3.6): morado primario #7E3FF2/#2E0A4D, acento
// amarillo #FFE600 — la misma identidad visual que ya usa el frontend.

interface DatosTarea {
  id: number;
  nombre: string;
  fechaFin: string; // YYYY-MM-DD
  proyectoNombre: string;
}

const FRONTEND_URL = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');

function formatearFecha(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split('-');
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const indice = parseInt(mes, 10) - 1;
  return `${parseInt(dia, 10)} de ${meses[indice] ?? mes} de ${anio}`;
}

function envoltura(tituloBadge: string, colorBadge: string, contenidoHtml: string, tarea: DatosTarea): string {
  const enlaceTarea = FRONTEND_URL ? `${FRONTEND_URL}/proyectos` : null;
  return `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#F4F2F8;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F2F8;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background-color:#2E0A4D;padding:20px 28px;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:#FFE600;margin-right:8px;"></span>
                <span style="color:#ffffff;font-size:16px;font-weight:bold;">FPT · Gestión de Proyectos</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <span style="display:inline-block;background-color:${colorBadge};color:#2E0A4D;font-size:12px;font-weight:bold;padding:4px 10px;border-radius:999px;letter-spacing:.03em;text-transform:uppercase;">
                  ${tituloBadge}
                </span>
                <h1 style="font-size:20px;color:#2E0A4D;margin:16px 0 4px;">${tarea.nombre}</h1>
                <p style="font-size:13px;color:#6b7280;margin:0 0 20px;">Proyecto: ${tarea.proyectoNombre}</p>
                ${contenidoHtml}
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:20px;background-color:#F4F2F8;border-radius:8px;">
                  <tr>
                    <td style="padding:14px 16px;font-size:13px;color:#2E0A4D;">
                      <strong>Fecha límite:</strong> ${formatearFecha(tarea.fechaFin)}
                    </td>
                  </tr>
                </table>
                ${
                  enlaceTarea
                    ? `<a href="${enlaceTarea}" style="display:inline-block;margin-top:24px;background-color:#7E3FF2;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 22px;border-radius:8px;">Ver en el sistema</a>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background-color:#F4F2F8;">
                <p style="font-size:11px;color:#9ca3af;margin:0;">Este es un correo automático de Fitness Para Todos — Gestión de Proyectos.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function asuntoAsignacion(tarea: DatosTarea): string {
  return `Te asignaron una tarea: ${tarea.nombre}`;
}

export function htmlAsignacion(tarea: DatosTarea): string {
  const cuerpo = `<p style="font-size:14px;color:#374151;line-height:1.5;margin:0;">Se te asignó esta tarea dentro del proyecto <strong>${tarea.proyectoNombre}</strong>. Puedes revisar el detalle y actualizar tu avance desde el sistema.</p>`;
  return envoltura('Nueva asignación', '#FFE600', cuerpo, tarea);
}

export function asuntoRecordatorio(tarea: DatosTarea, tipo: '48h' | '24h'): string {
  const horas = tipo === '48h' ? '48 horas' : '24 horas';
  return `Recordatorio: "${tarea.nombre}" vence en ${horas}`;
}

export function htmlRecordatorio(tarea: DatosTarea, tipo: '48h' | '24h'): string {
  const horas = tipo === '48h' ? '48 horas' : '24 horas';
  const colorBadge = tipo === '48h' ? '#FFE600' : '#F59E0B';
  const cuerpo = `<p style="font-size:14px;color:#374151;line-height:1.5;margin:0;">Quedan aproximadamente <strong>${horas}</strong> para la fecha límite de esta tarea. Si ya la terminaste, actualiza su estatus en el sistema para que este recordatorio no se repita.</p>`;
  return envoltura(`Vence en ${horas}`, colorBadge, cuerpo, tarea);
}

// Cuántos días completos pasaron desde fechaFin (DATE 'YYYY-MM-DD') hasta
// hoy — se calcula por componentes de fecha (no restando timestamps) para
// evitar corrimientos por zona horaria u horario de verano.
function diasDesde(fechaISO: string): number {
  const [anio, mes, dia] = fechaISO.split('-').map((v) => parseInt(v, 10));
  const fecha = Date.UTC(anio, mes - 1, dia);
  const hoy = new Date();
  const hoyUtc = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const msPorDia = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((hoyUtc - fecha) / msPorDia));
}

export function asuntoVencida(tarea: DatosTarea): string {
  return `Tarea vencida: "${tarea.nombre}"`;
}

export function htmlVencida(tarea: DatosTarea): string {
  const dias = diasDesde(tarea.fechaFin);
  const texto = dias === 0 ? 'venció hoy' : dias === 1 ? 'venció hace 1 día' : `venció hace ${dias} días`;
  const cuerpo = `<p style="font-size:14px;color:#374151;line-height:1.5;margin:0;">Esta tarea <strong>${texto}</strong> y sigue sin marcarse como completada. Actualiza su estatus o su fecha límite en el sistema para darle seguimiento.</p>`;
  return envoltura('Tarea vencida', '#E8384F', cuerpo, tarea);
}
