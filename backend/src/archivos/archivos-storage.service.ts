import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Envoltura delgada sobre Supabase Storage (mismo criterio que
// common/email.service.ts con Resend — aislado en su propio servicio para
// que ArchivosService no dependa directo del SDK). Usa la Service Role Key
// (nunca la anon key) porque el backend YA hace su propio control de
// acceso por rol/alcance antes de llamar aquí — no hace falta ni se quiere
// duplicar reglas de RLS de Supabase para esto.
//
// El bucket es privado (nunca público): nadie descarga un archivo pegando
// una URL de Supabase directamente, siempre pasa por un endpoint propio
// autenticado (ver ArchivosService.descargar) que primero re-valida el
// alcance del usuario sobre el proyecto/tarea dueño del adjunto.
const NOMBRE_BUCKET = 'adjuntos';

@Injectable()
export class ArchivosStorageService {
  private readonly logger = new Logger(ArchivosStorageService.name);
  private readonly cliente: SupabaseClient | null;
  private bucketVerificado = false;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.cliente = url && serviceKey ? createClient(url, serviceKey) : null;
    if (!this.cliente) {
      this.logger.warn(
        'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas — adjuntar archivos no funcionará hasta configurarlas.',
      );
    }
  }

  private clienteOFallar(): SupabaseClient {
    if (!this.cliente) {
      throw new InternalServerErrorException(
        'El almacenamiento de archivos no está configurado en este servidor (faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).',
      );
    }
    return this.cliente;
  }

  // Crea el bucket una sola vez si todavía no existe — así no hace falta
  // que alguien lo cree a mano desde el dashboard de Supabase antes del
  // primer uso. Se ignora el error si ya existe (carrera entre requests).
  private async asegurarBucket(cliente: SupabaseClient): Promise<void> {
    if (this.bucketVerificado) return;
    const { data } = await cliente.storage.getBucket(NOMBRE_BUCKET);
    if (!data) {
      const { error } = await cliente.storage.createBucket(NOMBRE_BUCKET, { public: false });
      if (error && !/already exists/i.test(error.message)) {
        throw new InternalServerErrorException(`No se pudo preparar el almacenamiento de archivos: ${error.message}`);
      }
    }
    this.bucketVerificado = true;
  }

  async subir(ruta: string, buffer: Buffer, tipoMime: string | undefined): Promise<void> {
    const cliente = this.clienteOFallar();
    await this.asegurarBucket(cliente);
    const { error } = await cliente.storage
      .from(NOMBRE_BUCKET)
      .upload(ruta, buffer, { contentType: tipoMime || 'application/octet-stream', upsert: false });
    if (error) {
      throw new InternalServerErrorException(`No se pudo subir el archivo: ${error.message}`);
    }
  }

  async descargar(ruta: string): Promise<Buffer> {
    const cliente = this.clienteOFallar();
    const { data, error } = await cliente.storage.from(NOMBRE_BUCKET).download(ruta);
    if (error || !data) {
      throw new InternalServerErrorException(`No se pudo descargar el archivo: ${error?.message ?? 'desconocido'}`);
    }
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async eliminar(ruta: string): Promise<void> {
    const cliente = this.clienteOFallar();
    const { error } = await cliente.storage.from(NOMBRE_BUCKET).remove([ruta]);
    if (error) {
      // No se rompe el flujo por esto — el registro en BD igual se borra
      // (ver ArchivosService.eliminar); queda un archivo huérfano en el
      // bucket en vez de bloquear al usuario, y se deja constancia en logs.
      this.logger.warn(`No se pudo borrar "${ruta}" del bucket (se ignora): ${error.message}`);
    }
  }
}
