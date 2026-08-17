// Plantilla HTML del correo de "recuperar contraseña" — misma identidad de
// marca que backend/src/alertas/plantillas.ts (morado #2E0A4D, acento
// #FFE600), pero autocontenida aquí para no acoplar Auth al módulo de
// Alertas (ese archivo está tipado específicamente para datos de tareas).
const FRONTEND_URL = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');

export function asuntoRestablecerPassword(): string {
  return 'Restablece tu contraseña — FPT Gestión de Proyectos';
}

export function htmlRestablecerPassword(nombre: string, token: string): string {
  const base = FRONTEND_URL || 'http://localhost:5173';
  const enlace = `${base}/restablecer-password?token=${encodeURIComponent(token)}`;

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
                <h1 style="font-size:20px;color:#2E0A4D;margin:0 0 12px;">Hola, ${nombre}</h1>
                <p style="font-size:14px;color:#374151;line-height:1.5;margin:0 0 20px;">
                  Recibimos una solicitud para restablecer la contraseña de tu cuenta. Si fuiste tú,
                  da clic en el siguiente botón para elegir una nueva contraseña. Este enlace es de
                  un solo uso y expira en 1 hora.
                </p>
                <a href="${enlace}" style="display:inline-block;background-color:#7E3FF2;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 22px;border-radius:8px;">Elegir nueva contraseña</a>
                <p style="font-size:12px;color:#9ca3af;line-height:1.5;margin:24px 0 0;">
                  Si tú no pediste este cambio, puedes ignorar este correo — tu contraseña actual
                  sigue funcionando y no se hizo ningún cambio en tu cuenta.
                </p>
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
