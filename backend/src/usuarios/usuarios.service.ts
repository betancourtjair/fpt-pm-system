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
import { Usuario } from '../entities/usuario.entity';
import { Rol } from '../entities/rol.entity';
import { Area } from '../entities/area.entity';
import { JwtPayload } from '../auth/auth.service';
import { esDirector } from '../common/permisos.util';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { AutorizarPresupuestoDto } from './dto/autorizar-presupuesto.dto';

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
    } else if (user.rol === 'gerente_area') {
      qb.andWhere('area.id = :areaId', { areaId: user.areaId });
    }

    const usuarios = await qb.getMany();
    return usuarios.map((u) => this.serializar(u));
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
}
