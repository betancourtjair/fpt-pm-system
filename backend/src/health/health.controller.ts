import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // Usado por Render para el health check del Web Service (sección 4.3 del
  // PID) — sin límite de peticiones: Render lo consulta seguido y nunca
  // debe bloquearse por el rate limiting agregado al resto de la API.
  @SkipThrottle()
  @Get()
  async check() {
    let db = 'down';
    try {
      await this.dataSource.query('SELECT 1');
      db = 'up';
    } catch {
      db = 'down';
    }
    return {
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      timestamp: new Date().toISOString(),
    };
  }
}
