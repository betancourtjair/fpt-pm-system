import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { isEmail } from 'class-validator';
import { Usuario } from '../entities/usuario.entity';
import { Rol } from '../entities/rol.entity';
import { Area } from '../entities/area.entity';
import { JwtPayload } from '../auth/auth.service';
import { esDirector } from '../common/permisos.util';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { AutorizarPresupuestoDto } from './dto/autorizar-presupuesto.dto';
import {
  generarPlantillaUsuariosExcel,
  parsearUsuariosExcel,
  FilaUsuarioExcel,
} from './excel-usuarios.util';

const DESCRIPCION_ROL: Record<string, string> = {
  admin: 'Alcance global. Gestiona usuarios, roles, catálogo, proyectos, tareas y presupuesto.',
  director:
    'Alcance de su Dirección completa. Gestiona proyectos, tareas y presupuesto de todas las Áreas bajo su Dirección.',
  gerente_area:
    'Alcance de su Área. Gestiona proyectos y tareas donde su Área está involucrada; no gestiona presupuesto.',
  colaborador:
    'Alcance de lo asignado. Ve y actualiza el avance únicamente de las tareas donde es responsable o colaborador. También puede crear proyectos dentro de su propia Área.',
};

// Sin caracteres ambiguos (0/O, 1/l/I) para que se puedan transcribir a
// mano sin errores si hace falta.
const MAYUS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MINUS = 'abcdefghijkmnpqrstuvwxyz';
const DIGITOS = '23456789';
const SIMBOLOS = '!@#$%*?';

function elegir(charset: string): string {
  return charset[randomBytes(1)[0] % charset.length];
}

// Contraseña temporal aleatoria (12 caracteres, con mayúscula/minúscula/
// dígito/símbolo garantizados) para las cuentas creadas por lote desde
// Excel — el mismo criterio de "must_change_password" que ya usa el alta
// individual se aplica aquí también.
function generarPasswordTemporal(): string {
  const base = [elegir(MAYUS), elegir(MINUS), elegir(DIGITOS), elegir(SIMBOLOS)];
  const todos = MAYUS + MINUS + DIGITOS + SIMBOLOS;
  while (base.length < 12) base.push(elegir(todos));
  for (let i = base.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join('');
}

export interface ResultadoFilaImportacion {
  fila: number;
  nombre: string;
  email: string;
  ok: boolean;
  mensaje?: string;
  rol?: string;
  passwordTemporal?: string;
}

const RELACIONES = { rol: true, area: { direccion: true } } as const;

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Rol) private readonly roles: Repository<Rol>,
    @InjectRepository(Area) private readonly areas: Repository<Area>,
  ) {}

  private serializar(u: Usuario) {
    return {
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      activo: u.activo,
      mustChangePassword: u.mustChangePassword,
      verPresupuestoAutorizado: u.verPresupuestoAutorizado,
      rolId: u.rolId,
      rol: u.rol?.nombre ?? null,
      areaId: u.areaId,
      area: u.area?.nombre ?? null,
      direccionId: u.area?.direccionId ?? null,
      direccion: u.area?.direccion?.nombre ?? null,
    };
  }

  async listar(user: JwtPayload) {
    const qb = this.usuarios
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.rol', 'rol')
      .leftJoinAndSelect('u.area', 'area')
      .leftJoinAndSelect('area.direccion', 'direccion')
      .orderBy('u.id', 'ASC');

    if (esDirector(user)) {
      qb.andWhere('direccion.id = :direccionId', { direccionId: user.direccionId });
    } else if (user.rol === 'gerente_area' || user.rol === 'colaborador') {
      // colaborador (mejora reportada por el usuario): mismo candado que
      // gerente_area — solo ve a quienes comparten su Área, para poder
      // elegir un Responsable al crear un proyecto sin exponerle el
      // directorio completo de la empresa.
      qb.andWhere('area.id = :areaId', { areaId: user.areaId });
    }

    const usuarios = await qb.getMany();
    return usuarios.map((u) => this.serializar(u));
  }

  // Vista de carga de trabajo (tercera ronda de mejoras, ver README sección
  // 4): cuántas tareas activas (no completadas) trae cada persona del
  // equipo, cruzando TODOS sus proyectos — para que un Manager/Director
  // detecte quién está saturado antes de asignarle algo más. El universo de
  // personas es el mismo que ya ve /usuarios (alcance por rol); los conteos
  // de tareas NO se limitan a un proyecto, es la carga total de la persona.
  async cargaTrabajo(user: JwtPayload) {
    const usuarios = await this.listar(user);
    if (usuarios.length === 0) return [];

    const ids = usuarios.map((u) => u.id);
    const filas: { usuario_id: number; activas: string; vencidas: string }[] = await this.usuarios.query(
      `SELECT usuario_id, COUNT(DISTINCT tarea_id) AS activas,
              COUNT(DISTINCT CASE WHEN fecha_fin < CURRENT_DATE THEN tarea_id END) AS vencidas
       FROM (
         SELECT id AS tarea_id, responsable_id AS usuario_id, fecha_fin, estatus
         FROM tareas WHERE estatus <> 'completada' AND responsable_id IS NOT NULL
         UNION
         SELECT t.id, tu.usuario_id, t.fecha_fin, t.estatus
         FROM tareas t JOIN tarea_usuarios tu ON tu.tarea_id = t.id
         WHERE t.estatus <> 'completada'
       ) x
       WHERE usuario_id = ANY($1)
       GROUP BY usuario_id`,
      [ids],
    );
    const porUsuario = new Map(filas.map((f) => [f.usuario_id, { activas: Number(f.activas), vencidas: Number(f.vencidas) }]));

    return usuarios
      .map((u) => ({
        id: u.id,
        nombre: u.nombre,
        rol: u.rol,
        area: u.area,
        direccion: u.direccion,
        tareasActivas: porUsuario.get(u.id)?.activas ?? 0,
        tareasVencidas: porUsuario.get(u.id)?.vencidas ?? 0,
      }))
      .sort((a, b) => b.tareasActivas - a.tareasActivas);
  }

  async obtenerEntidad(id: number): Promise<Usuario> {
    const usuario = await this.usuarios.findOne({ where: { id }, relations: RELACIONES });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');
    return usuario;
  }

  async obtener(id: number) {
    return this.serializar(await this.obtenerEntidad(id));
  }

  // El rol "admin" tiene alcance global (PID sección 9.2): no pertenece a
  // ninguna Dirección/Área, así que aquí se fuerza areaId a null sin
  // importar lo que se haya enviado. Cualquier otro rol sí necesita un
  // área válida (de ahí depende su alcance de Dirección).
  private async validarRolYArea(
    rolId: number,
    areaId: number | null | undefined,
  ): Promise<{ rol: Rol; areaIdFinal: number | null }> {
    const rol = await this.roles.findOne({ where: { id: rolId } });
    if (!rol) throw new NotFoundException('El rol indicado no existe.');

    if (rol.nombre === 'admin') {
      return { rol, areaIdFinal: null };
    }

    if (!areaId) {
      throw new BadRequestException('Los usuarios con este rol deben pertenecer a un área.');
    }
    const area = await this.areas.findOne({ where: { id: areaId } });
    if (!area) throw new NotFoundException('El área indicada no existe.');
    return { rol, areaIdFinal: areaId };
  }

  private async verificarEmailDisponible(email: string, idExcluido?: number) {
    const existente = await this.usuarios.findOne({ where: { email } });
    if (existente && existente.id !== idExcluido) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }
  }

  async crear(dto: CreateUsuarioDto) {
    await this.verificarEmailDisponible(dto.email);
    const { areaIdFinal } = await this.validarRolYArea(dto.rolId, dto.areaId ?? null);

    const usuario = this.usuarios.create({
      nombre: dto.nombre,
      email: dto.email,
      passwordHash: await bcrypt.hash(dto.password, 10),
      rolId: dto.rolId,
      areaId: areaIdFinal,
      activo: true,
      // Igual que en el alta inicial (seed.sql): el usuario debe fijar su
      // propia contraseña real en el primer login.
      mustChangePassword: true,
    });
    const guardado = await this.usuarios.save(usuario);
    return this.obtener(guardado.id);
  }

  async actualizar(id: number, dto: UpdateUsuarioDto) {
    const usuario = await this.obtenerEntidad(id);

    // IMPORTANTE: se guarda con un UPDATE dirigido (no usuario.save()) —
    // `usuario` se cargó con las relaciones rol/area ya resueltas; si solo
    // se reasigna la columna escalar (rolId/areaId) y se guarda la entidad
    // completa, TypeORM puede preferir el objeto de relación viejo que
    // sigue en memoria y el cambio se pierde en silencio.
    const cambios: Record<string, unknown> = {};

    if (dto.email && dto.email !== usuario.email) {
      await this.verificarEmailDisponible(dto.email, id);
      cambios.email = dto.email;
    }
    if (dto.nombre) cambios.nombre = dto.nombre;

    if (dto.rolId !== undefined || dto.areaId !== undefined) {
      const rolId = dto.rolId ?? usuario.rolId;
      const areaSolicitada = dto.areaId !== undefined ? dto.areaId : usuario.areaId;
      const { areaIdFinal } = await this.validarRolYArea(rolId, areaSolicitada);
      cambios.rolId = rolId;
      cambios.areaId = areaIdFinal;
    }

    if (dto.activo !== undefined) cambios.activo = dto.activo;

    if (dto.nuevaPassword) {
      cambios.passwordHash = await bcrypt.hash(dto.nuevaPassword, 10);
      cambios.mustChangePassword = true;
    }

    if (Object.keys(cambios).length > 0) {
      await this.usuarios.update(id, cambios);
    }
    return this.obtener(id);
  }

  // Solo admin/director pueden mover este flag; un director además solo
  // sobre gerentes de área dentro de su propia Dirección (PID sección 8).
  async autorizarPresupuesto(id: number, dto: AutorizarPresupuestoDto, user: JwtPayload) {
    const objetivo = await this.obtenerEntidad(id);
    if (objetivo.rol.nombre !== 'gerente_area') {
      throw new BadRequestException(
        'Solo se puede autorizar la visibilidad de presupuesto a usuarios con rol gerente_area.',
      );
    }
    if (esDirector(user) && objetivo.area?.direccionId !== user.direccionId) {
      throw new ForbiddenException('Solo puedes autorizar usuarios de tu propia Dirección.');
    }

    objetivo.verPresupuestoAutorizado = dto.autorizar;
    objetivo.presupuestoAutorizadoPor = dto.autorizar ? user.sub : null;
    objetivo.presupuestoAutorizadoEn = dto.autorizar ? new Date() : null;
    await this.usuarios.save(objetivo);
    return { ok: true, verPresupuestoAutorizado: objetivo.verPresupuestoAutorizado };
  }

  // Carga masiva de usuarios (admin) — ver excel-usuarios.util.ts para el
  // formato exacto de la plantilla (hojas Instrucciones/Catálogo/Usuarios).
  async generarPlantillaExcel(): Promise<Buffer> {
    const [areas, roles] = await Promise.all([
      this.areas.find({ relations: { direccion: true }, order: { direccionId: 'ASC', nombre: 'ASC' } }),
      this.roles.find({ order: { id: 'ASC' } }),
    ]);

    const direcciones = Array.from(new Set(areas.map((a) => a.direccion.nombre)));
    const areasConDireccion = areas.map((a) => ({ nombre: a.nombre, direccionNombre: a.direccion.nombre }));
    const rolesConDescripcion = roles.map((r) => ({
      nombre: r.nombre,
      descripcion: DESCRIPCION_ROL[r.nombre] ?? '',
    }));

    return generarPlantillaUsuariosExcel(direcciones, areasConDireccion, rolesConDescripcion);
  }

  async importarExcel(buffer: Buffer): Promise<{
    total: number;
    creados: number;
    conError: number;
    resultados: ResultadoFilaImportacion[];
  }> {
    let filas: FilaUsuarioExcel[];
    try {
      filas = await parsearUsuariosExcel(buffer);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo leer el archivo. Usa la plantilla descargada desde el sistema.',
      );
    }

    if (filas.length === 0) {
      throw new BadRequestException(
        'El archivo no tiene filas para importar (revisa que hayas llenado la hoja "Usuarios" y borrado la fila de ejemplo).',
      );
    }

    const [roles, areas, usuariosExistentes] = await Promise.all([
      this.roles.find(),
      this.areas.find({ relations: { direccion: true } }),
      this.usuarios.find({ select: { email: true } }),
    ]);

    const emailsExistentes = new Set(usuariosExistentes.map((u) => u.email.toLowerCase()));
    const emailsEnArchivo = new Set<string>();
    const resultados: ResultadoFilaImportacion[] = [];

    for (const fila of filas) {
      const resultado = await this.procesarFilaImportacion(fila, roles, areas, emailsExistentes, emailsEnArchivo);
      resultados.push(resultado);
      if (resultado.ok) {
        emailsExistentes.add(fila.email.toLowerCase());
        emailsEnArchivo.add(fila.email.toLowerCase());
      }
    }

    return {
      total: resultados.length,
      creados: resultados.filter((r) => r.ok).length,
      conError: resultados.filter((r) => !r.ok).length,
      resultados,
    };
  }

  private async procesarFilaImportacion(
    fila: FilaUsuarioExcel,
    roles: Rol[],
    areas: Area[],
    emailsExistentes: Set<string>,
    emailsEnArchivo: Set<string>,
  ): Promise<ResultadoFilaImportacion> {
    const base = { fila: fila.fila, nombre: fila.nombre, email: fila.email };

    if (!fila.nombre || fila.nombre.length < 3) {
      return { ...base, ok: false, mensaje: 'El nombre debe tener al menos 3 caracteres.' };
    }
    if (!fila.email || !isEmail(fila.email)) {
      return { ...base, ok: false, mensaje: 'El correo electrónico no es válido.' };
    }
    const emailNormalizado = fila.email.toLowerCase();
    if (emailsEnArchivo.has(emailNormalizado)) {
      return { ...base, ok: false, mensaje: 'Correo duplicado dentro del mismo archivo.' };
    }
    if (emailsExistentes.has(emailNormalizado)) {
      return { ...base, ok: false, mensaje: 'Ya existe un usuario con este correo en el sistema.' };
    }

    const rol = roles.find((r) => r.nombre.toLowerCase() === fila.rol.trim().toLowerCase());
    if (!rol) {
      return {
        ...base,
        ok: false,
        mensaje: `Rol "${fila.rol}" no es válido. Usa: admin, director, gerente_area o colaborador.`,
      };
    }

    let areaIdFinal: number | null = null;
    if (rol.nombre !== 'admin') {
      if (!fila.direccion || !fila.area) {
        return { ...base, ok: false, mensaje: 'Los usuarios con este rol deben indicar Dirección y Área.' };
      }
      const area = areas.find(
        (a) =>
          a.nombre.toLowerCase() === fila.area.trim().toLowerCase() &&
          a.direccion.nombre.toLowerCase() === fila.direccion.trim().toLowerCase(),
      );
      if (!area) {
        return {
          ...base,
          ok: false,
          mensaje: `El Área "${fila.area}" no pertenece a la Dirección "${fila.direccion}" (revisa la hoja Catálogo).`,
        };
      }
      areaIdFinal = area.id;
    }

    const passwordTemporal = generarPasswordTemporal();
    const usuario = this.usuarios.create({
      nombre: fila.nombre,
      email: fila.email,
      passwordHash: await bcrypt.hash(passwordTemporal, 10),
      rolId: rol.id,
      areaId: areaIdFinal,
      activo: true,
      mustChangePassword: true,
    });
    await this.usuarios.save(usuario);

    return { ...base, ok: true, rol: rol.nombre, passwordTemporal };
  }
}
