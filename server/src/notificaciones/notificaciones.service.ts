import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EnvioNotificacion, Notificacion, Sede, Usuario } from '../entities';
import { TipoActor } from '../entities/enums';
import type { PaginatedResponse } from '../common/types/paginated-response.type';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { NotificadorFactory } from './notificadores/notificador.factory';
import {
  AudienciaEnvio,
  CANAL_CON_CONTADORES_PERSISTIDOS,
  TipoNotificacion,
  type CanalNotificacion,
  type Destinatario,
  type MensajeNotificacion,
  type Notificador,
  type ResultadoCanal,
  type ResultadoNotificacion,
} from './notificaciones.types';
import type { CrearEnvioDto } from './dto/crear-envio.dto';
import type { NotificacionesQueryDto } from './dto/notificaciones-query.dto';

export interface NotificacionVista {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  creadaEn: Date;
  leidaEn: Date | null;
}

export interface EnvioVista {
  id: string;
  titulo: string;
  mensaje: string;
  audiencia: string;
  sede: { id: string; nombre: string } | null;
  destinatario: { nombre: string; apellido: string } | null;
  canales: string[];
  creadoPor: { nombre: string; apellido: string } | null;
  creadaEn: Date;
  totalDestinatarios: number;
  emailsEnviados: number;
  emailsFallidos: number;
}

interface FiltroAudiencia {
  audiencia: AudienciaEnvio;
  sedeId?: string;
  usuarioId?: string;
}

// Orquesta los canales. Quienes emiten eventos de dominio (listeners) y el
// controlador de envíos usan SOLO este servicio: no conocen los canales.
@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    private readonly factory: NotificadorFactory,
    @InjectRepository(Notificacion)
    private readonly notificacionesRepo: Repository<Notificacion>,
    @InjectRepository(EnvioNotificacion)
    private readonly enviosRepo: Repository<EnvioNotificacion>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    @InjectRepository(Sede)
    private readonly sedesRepo: Repository<Sede>,
  ) {}

  // ───────────── Envío por canales (nunca lanza) ─────────────

  async notificar(
    destinatarios: Destinatario[],
    mensaje: MensajeNotificacion,
    canales: readonly CanalNotificacion[],
  ): Promise<ResultadoNotificacion> {
    return this.enviarLote(
      destinatarios.map((destinatario) => ({ destinatario, mensaje })),
      canales,
    );
  }

  // Igual que `notificar`, pero cada destinatario lleva su propio mensaje (p. ej.
  // las fechas de SUS clases canceladas). Misma pausa entre mails y mismo
  // aislamiento de fallos.
  notificarPersonalizado(
    items: Array<{ destinatario: Destinatario; mensaje: MensajeNotificacion }>,
    canales: readonly CanalNotificacion[],
  ): Promise<ResultadoNotificacion> {
    return this.enviarLote(items, canales);
  }

  // Sin ramas por canal: cada notificador declara su elegibilidad y su pausa.
  private async enviarLote(
    items: Array<{ destinatario: Destinatario; mensaje: MensajeNotificacion }>,
    canales: readonly CanalNotificacion[],
  ): Promise<ResultadoNotificacion> {
    const resultado: ResultadoNotificacion = {
      destinatarios: items.length,
      porCanal: {},
    };
    for (const canal of new Set(canales)) {
      let notificador: Notificador;
      try {
        notificador = this.factory.crear(canal);
      } catch {
        this.logger.warn('Se ignoró un canal de notificación desconocido');
        continue;
      }
      const delCanal: ResultadoCanal = {
        enviados: 0,
        fallidos: 0,
        omitidos: 0,
      };
      resultado.porCanal[canal] = delCanal;
      let hayEnvioPrevio = false;
      for (const { destinatario, mensaje } of items) {
        // Los no elegibles ni se intentan ni cuentan como fallidos.
        if (!notificador.puedeNotificar(destinatario)) {
          delCanal.omitidos++;
          continue;
        }
        if (hayEnvioPrevio && notificador.pausaMs > 0) {
          await this.esperar(notificador.pausaMs);
        }
        hayEnvioPrevio = true;
        let ok = false;
        try {
          ok = await notificador.enviar(destinatario, mensaje);
        } catch {
          ok = false;
        }
        if (ok) delCanal.enviados++;
        else delCanal.fallidos++;
      }
    }
    return resultado;
  }

  // Atajo para los listeners: un usuario ya cargado.
  notificarUsuario(
    usuario: Pick<Usuario, 'id' | 'nombre' | 'email' | 'emailVerificado'>,
    mensaje: MensajeNotificacion,
    canales: readonly CanalNotificacion[],
  ): Promise<ResultadoNotificacion> {
    return this.notificar([this.aDestinatario(usuario)], mensaje, canales);
  }

  protected esperar(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private aDestinatario(
    u: Pick<Usuario, 'id' | 'nombre' | 'email' | 'emailVerificado'>,
  ): Destinatario {
    return {
      id: u.id,
      nombre: u.nombre,
      email: u.email ?? null,
      emailVerificado: !!u.emailVerificado,
    };
  }

  // ───────────── Audiencias ─────────────

  // Solo SOCIOS activos. "De una sede": con esa sede asignada o dada de alta
  // en ella por la membresía (mismo criterio que el listado de clientes del
  // cobro en efectivo, sin el criterio de "tuvo una reserva de cancha").
  async resolverAudiencia(filtro: FiltroAudiencia): Promise<Destinatario[]> {
    const base = { tipoActor: TipoActor.SOCIO, activo: true };
    let where: object | object[];
    switch (filtro.audiencia) {
      case AudienciaEnvio.TODOS_LOS_SOCIOS:
        where = base;
        break;
      case AudienciaEnvio.SOCIOS_DE_SEDE: {
        if (!filtro.sedeId) throw new BadRequestException('Falta la sede');
        const sede = await this.sedesRepo.findOne({
          where: { id: filtro.sedeId },
        });
        if (!sede) throw new NotFoundException('La sede no existe');
        where = [
          { ...base, sede: { id: filtro.sedeId } },
          { ...base, membresias: { sedeAlta: { id: filtro.sedeId } } },
        ];
        break;
      }
      case AudienciaEnvio.SOCIO:
        if (!filtro.usuarioId) throw new BadRequestException('Falta el socio');
        where = { ...base, id: filtro.usuarioId };
        break;
      default:
        throw new BadRequestException('Audiencia desconocida');
    }
    const filas = await this.usuariosRepo.find({ where });
    // Defensa en profundidad: aunque la consulta cambie, solo socios activos.
    const vistos = new Set<string>();
    const destinatarios: Destinatario[] = [];
    for (const u of filas) {
      if (u.tipoActor !== TipoActor.SOCIO || !u.activo) continue;
      if (vistos.has(u.id)) continue;
      vistos.add(u.id);
      destinatarios.push(this.aDestinatario(u));
    }
    if (filtro.audiencia === AudienciaEnvio.SOCIO && !destinatarios.length) {
      throw new NotFoundException('El socio no existe o no está activo');
    }
    return destinatarios;
  }

  async previsualizar(
    filtro: FiltroAudiencia,
  ): Promise<{ cantidad: number; conEmailVerificado: number }> {
    const dest = await this.resolverAudiencia(filtro);
    const notificador = this.factory.crear(CANAL_CON_CONTADORES_PERSISTIDOS);
    return {
      cantidad: dest.length,
      conEmailVerificado: dest.filter((d) => notificador.puedeNotificar(d))
        .length,
    };
  }

  // ───────────── Envíos del Gerente General ─────────────

  // Registra el envío y responde enseguida; los canales se procesan en segundo
  // plano (los mails llevan una pausa entre uno y otro).
  async crearEnvio(
    dto: CrearEnvioDto,
    currentUser: UsuarioAutenticado,
  ): Promise<EnvioVista> {
    // Un canal del enum sin notificador registrado falla acá con 400, antes de
    // guardar nada (la fábrica lanza BadRequestException).
    for (const canal of dto.canales) this.factory.crear(canal);
    const destinatarios = await this.resolverAudiencia(dto);
    if (!destinatarios.length) {
      throw new BadRequestException(
        'No hay socios activos en esa audiencia: no se envió nada',
      );
    }
    const envio = await this.enviosRepo.save(
      this.enviosRepo.create({
        titulo: dto.titulo,
        mensaje: dto.mensaje,
        audiencia: dto.audiencia,
        sede:
          dto.audiencia === AudienciaEnvio.SOCIOS_DE_SEDE
            ? ({ id: dto.sedeId } as Sede)
            : null,
        usuario:
          dto.audiencia === AudienciaEnvio.SOCIO
            ? ({ id: dto.usuarioId } as Usuario)
            : null,
        canales: [...new Set(dto.canales)],
        creadoPor: { id: currentUser.id } as Usuario,
        totalDestinatarios: destinatarios.length,
      }),
    );
    void this.procesarEnvio(
      envio.id,
      destinatarios,
      {
        tipo: TipoNotificacion.AVISO_GENERAL,
        titulo: dto.titulo,
        mensaje: dto.mensaje,
        envioId: envio.id,
      },
      dto.canales,
    );
    return {
      id: envio.id,
      titulo: envio.titulo,
      mensaje: envio.mensaje,
      audiencia: envio.audiencia,
      sede: null,
      destinatario: null,
      canales: envio.canales,
      creadoPor: null,
      creadaEn: envio.creadaEn,
      totalDestinatarios: envio.totalDestinatarios,
      emailsEnviados: 0,
      emailsFallidos: 0,
    };
  }

  // Tarea en segundo plano: nunca rechaza (queda registrado en el log).
  async procesarEnvio(
    envioId: string,
    destinatarios: Destinatario[],
    mensaje: MensajeNotificacion,
    canales: CanalNotificacion[],
  ): Promise<void> {
    try {
      const r = await this.notificar(destinatarios, mensaje, canales);
      // Las columnas existentes llevan los contadores de un solo canal.
      const contadores = r.porCanal[CANAL_CON_CONTADORES_PERSISTIDOS];
      await this.enviosRepo.update(envioId, {
        emailsEnviados: contadores?.enviados ?? 0,
        emailsFallidos: contadores?.fallidos ?? 0,
      });
    } catch {
      this.logger.warn('Falló el procesamiento de un envío de notificaciones');
    }
  }

  async historial(
    query: NotificacionesQueryDto,
  ): Promise<PaginatedResponse<EnvioVista>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [filas, total] = await this.enviosRepo.findAndCount({
      relations: { sede: true, usuario: true, creadoPor: true },
      order: { creadaEn: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: filas.map((e) => ({
        id: e.id,
        titulo: e.titulo,
        mensaje: e.mensaje,
        audiencia: e.audiencia,
        sede: e.sede ? { id: e.sede.id, nombre: e.sede.nombre } : null,
        destinatario: e.usuario
          ? { nombre: e.usuario.nombre, apellido: e.usuario.apellido }
          : null,
        canales: e.canales,
        creadoPor: e.creadoPor
          ? { nombre: e.creadoPor.nombre, apellido: e.creadoPor.apellido }
          : null,
        creadaEn: e.creadaEn,
        totalDestinatarios: e.totalDestinatarios,
        emailsEnviados: e.emailsEnviados,
        emailsFallidos: e.emailsFallidos,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ───────────── Campanita del Socio (siempre con el id del JWT) ─────────────

  private vista(n: Notificacion): NotificacionVista {
    return {
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      mensaje: n.mensaje,
      creadaEn: n.creadaEn,
      leidaEn: n.leidaEn ?? null,
    };
  }

  async listar(
    usuarioId: string,
    query: NotificacionesQueryDto,
  ): Promise<PaginatedResponse<NotificacionVista>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [filas, total] = await this.notificacionesRepo.findAndCount({
      where: { usuario: { id: usuarioId } },
      order: { creadaEn: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: filas.map((n) => this.vista(n)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async contarNoLeidas(usuarioId: string): Promise<{ noLeidas: number }> {
    const noLeidas = await this.notificacionesRepo.count({
      where: { usuario: { id: usuarioId }, leidaEn: IsNull() },
    });
    return { noLeidas };
  }

  // 404 si no existe o no es del usuario (no se distingue, para no filtrar ids).
  async marcarLeida(id: string, usuarioId: string): Promise<NotificacionVista> {
    const n = await this.notificacionesRepo.findOne({
      where: { id, usuario: { id: usuarioId } },
    });
    if (!n) throw new NotFoundException('Notificación no encontrada');
    if (!n.leidaEn) {
      n.leidaEn = new Date();
      await this.notificacionesRepo.update(id, { leidaEn: n.leidaEn });
    }
    return this.vista(n);
  }

  async marcarTodasLeidas(
    usuarioId: string,
  ): Promise<{ actualizadas: number }> {
    const res = await this.notificacionesRepo
      .createQueryBuilder()
      .update(Notificacion)
      .set({ leidaEn: new Date() })
      .where('usuario_id = :usuarioId AND leida_en IS NULL', { usuarioId })
      .execute();
    return { actualizadas: res.affected ?? 0 };
  }
}
