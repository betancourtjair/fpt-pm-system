import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

// Envoltura delgada sobre Resend (Fase 2, PID sección 7). Aislado en su
// propio servicio para que AlertasService no dependa directo del SDK: si
// mañana cambia el proveedor de correo, solo se toca este archivo.
//
// REMITENTE: usa el dominio raíz fpt.com.mx, que es el que Resend marca
// "Verified" (tiene el DKIM en resend._domainkey.fpt.com.mx). OJO — el
// subdominio "send." NO sirve para esto: sus registros MX/TXT son solo el
// Return-Path/bounce interno que usa Resend/SES, nunca la dirección "From"
// visible; usarlo como remitente hace que Resend rechace el correo con
// "The send.fpt.com.mx domain is not verified" (se detectó este error real
// en producción — ver logs de Render del 16 de agosto). Se puede
// sobreescribir con la variable de entorno EMAIL_REMITENTE si se prefiere
// otra dirección dentro del dominio ya verificado (@fpt.com.mx).
const REMITENTE = process.env.EMAIL_REMITENTE || 'Notificaciones FPT <notificaciones@fpt.com.mx>';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    // Sin API key (ej. en desarrollo local sin credenciales reales) el
    // servicio sigue funcionando: solo registra en el log y deja que el
    // llamador maneje el "envío" como fallido, en vez de tronar el proceso.
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async enviar(destinatario: string, asunto: string, html: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.resend) {
      this.logger.warn(`RESEND_API_KEY no configurada — no se envió el correo a ${destinatario} (${asunto})`);
      return { ok: false, error: 'RESEND_API_KEY no configurada' };
    }
    try {
      const respuesta = await this.resend.emails.send({
        from: REMITENTE,
        to: destinatario,
        subject: asunto,
        html,
      });
      if (respuesta.error) {
        this.logger.error(`Resend rechazó el correo a ${destinatario}: ${respuesta.error.message}`);
        return { ok: false, error: respuesta.error.message };
      }
      return { ok: true };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido enviando el correo';
      this.logger.error(`Fallo al enviar correo a ${destinatario}: ${mensaje}`);
      return { ok: false, error: mensaje };
    }
  }
}
