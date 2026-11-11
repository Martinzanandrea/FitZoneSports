import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomInt, randomUUID } from 'crypto';
import { ControlAcceso, Membresia, Usuario, Sede } from '../entities';
import type { MetodoIngreso } from '../entities/control-acceso.entity';
import { EstadoMembresia, TipoActor } from '../entities/enums';
import { estadoDesde } from '../membresias/estado-membresia';
import {
  esProxima,
  esVigente,
  hoyArgentina,
  obtenerVigente,
} from '../membresias/vigencia';
import {
  esViolacionUnique,
  restriccionViolada,
} from '../common/helpers/db-errors.helper';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/types/paginated-response.type';
import { ClavesQrService, type ClavePublicaQr } from './claves-qr.service';
import type { EventoOfflineDto } from './dto/sincronizar-acceso.dto';

interface QrPayload {
  usuarioId: string;
  tipo: 'qr-acceso';
  // Identificador único de este QR: permite rechazar un segundo uso del
  // mismo token dentro de sus 60 segundos (captura de pantalla compartida).
  jti?: string;
  exp?: number;
}

interface CodigoCorto {
  usuarioId: string;
  expiraEnMs: number;
}

// El snapshot offline vale 24 horas desde que se genera.
const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

// Sincronización de ingresos offline.
const TOLERANCIA_RELOJ_MS = 120_000; // el reloj del terminal puede desfasarse
const ANTIGUEDAD_MAXIMA_MS = 72 * 60 * 60 * 1000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SQL_INSERTAR_EVENTO = `INSERT INTO eventos_acceso_offline
  (client_event_id, sede_id, usuario_id, qr_jti, ocurrido_en, estado, codigo, mensaje, acceso_id)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;
const SQL_INSERTAR_ACCESO = `INSERT INTO control_acceso
  (id, usuario_id, sede_id, hora_ingreso, metodo_ingreso, validado_offline, sincronizado_en, observacion)
  VALUES ($1, $2, $3, $4, 'QR_OFFLINE', true, $5, $6)`;
const SQL_ENLAZAR_ACCESO = `UPDATE eventos_acceso_offline SET acceso_id = $2 WHERE client_event_id = $1`;
const SQL_BUSCAR_EVENTO = `SELECT estado, codigo, acceso_id FROM eventos_acceso_offline WHERE client_event_id = $1`;

export type EstadoSincronizacion =
  'CREADO' | 'OBSERVADO' | 'CONFLICTO' | 'RECHAZADO';

export interface ResultadoSincronizacion {
  clientEventId: string;
  estado: EstadoSincronizacion;
  codigo: string;
  accesoId?: string;
  mensaje?: string;
}

// Fila de eventos_acceso_offline: el resultado de procesar un evento.
interface ResultadoOffline {
  clientEventId: string;
  sedeId: string;
  usuarioId: string | null;
  qrJti: string | null;
  ocurridoEn: Date;
  estado: EstadoSincronizacion;
  codigo: string;
  mensaje: string | null;
  accesoId: string | null;
}

// Datos del QR ya verificados con la firma: nunca vienen del cliente.
interface QrOfflineVerificado {
  usuarioId: string;
  jti: string;
  iat: number;
  exp: number;
}

// 60 segundos, igual que el QR (ambos se generan y vencen juntos).
const CODIGO_CORTO_TTL_MS = 60_000;

export type EstadoMembresiaVista =
  'VIGENTE' | 'PROXIMA' | 'SUSPENDIDA' | 'VENCIDA' | 'SIN_MEMBRESIA';

// Lo único que ve el recepcionista antes de confirmar un ingreso por DNI.
export interface VistaPreviaSocio {
  nombre: string;
  apellido: string;
  fotoUrl: string | null;
  estadoMembresia: EstadoMembresiaVista;
}

// Lo que el terminal descarga para validar QR sin servidor. Solo los campos
// mínimos: nada de DNI, email, teléfono, foto ni plan.
export interface SnapshotAcceso {
  sedeId: string;
  generadoEn: string;
  venceEn: string;
  clave: ClavePublicaQr;
  aforo: { actual: number; maximo: number };
  dentro: string[];
  socios: Array<{
    id: string;
    nombre: string;
    apellido: string;
    desde: string;
    hasta: string;
  }>;
}

export interface ResumenAccesoSede {
  sedeId: string;
  sede: string;
  aforoActual: number;
  aforoMaximo: number;
  ingresosHoy: number;
  egresosHoy: number;
}

export interface ResumenAccesos {
  porSede: ResumenAccesoSede[];
  totalIngresosHoy: number;
  totalEgresosHoy: number;
}

@Injectable()
export class AccesoService {
  constructor(
    @InjectRepository(ControlAcceso)
    private readonly accesoRepo: Repository<ControlAcceso>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    @InjectRepository(Sede)
    private readonly sedesRepo: Repository<Sede>,
    @InjectRepository(Membresia)
    private readonly membresiasRepo: Repository<Membresia>,
    private readonly jwtService: JwtService,
    private readonly claves: ClavesQrService,
  ) {}

  // RF-04: el QR de acceso es exclusivo de Socios con membresía activa.
  // Mismo criterio que RN-03 en reserva-clase.service.ts.
  private async exigirSocioConMembresiaActiva(usuario: Usuario): Promise<void> {
    if (usuario.tipoActor !== TipoActor.SOCIO) {
      throw new ForbiddenException('El acceso por QR es exclusivo de socios');
    }
    // Vigente HOY por fechas (hora argentina), no solo por estado.
    const membresia = await obtenerVigente(this.membresiasRepo, usuario.id);
    if (!membresia || !estadoDesde(membresia).puedeGenerarQr()) {
      throw new ForbiddenException(
        'Necesitás una membresía activa para generar tu código de acceso',
      );
    }
  }

  // Códigos cortos de 6 dígitos, alternativa práctica al token largo.
  // En memoria (no sobrevive reinicios ni se comparte entre instancias).
  private readonly codigosCortos = new Map<string, CodigoCorto>();

  // QR ya usados (jti -> vencimiento en ms). Se recuerdan hasta que el token
  // vence: después el JWT ya no verifica y no hace falta guardarlos.
  private readonly qrUsados = new Map<string, number>();

  // RF04: QR dinámico que rota cada minuto.
  async generarQr(
    usuarioId: string,
  ): Promise<{ qrToken: string; codigoCorto: string; expiraEn: number }> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id: usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${usuarioId} no encontrado`);

    await this.exigirSocioConMembresiaActiva(usuario);

    this.purgarCodigosExpirados();

    const payload: QrPayload = {
      usuarioId,
      tipo: 'qr-acceso',
      jti: randomUUID(),
    };
    // Con clave ES256 el terminal puede verificar el QR sin servidor; sin ella
    // se sigue firmando HS256 con JWT_SECRET.
    const clave = this.claves.publica;
    const qrToken =
      this.claves.clavePrivada && clave
        ? this.jwtService.sign(payload, {
            expiresIn: '60s',
            // `secret` y no `privateKey`: @nestjs/jwt prefiere el secret del módulo
            // (HS256) sobre privateKey, y no queremos tocar el JwtModule.
            secret: this.claves.clavePrivada,
            algorithm: 'ES256',
            keyid: clave.kid,
          })
        : this.jwtService.sign(payload, { expiresIn: '60s' });
    const codigoCorto = this.generarCodigoCortoUnico();
    this.codigosCortos.set(codigoCorto, {
      usuarioId,
      expiraEnMs: Date.now() + CODIGO_CORTO_TTL_MS,
    });
    return { qrToken, codigoCorto, expiraEn: 60 };
  }

  private purgarCodigosExpirados(): void {
    const ahora = Date.now();
    for (const [codigo, entrada] of this.codigosCortos) {
      if (entrada.expiraEnMs <= ahora) this.codigosCortos.delete(codigo);
    }
    for (const [jti, expiraEnMs] of this.qrUsados) {
      if (expiraEnMs <= ahora) this.qrUsados.delete(jti);
    }
  }

  private generarCodigoCortoUnico(): string {
    for (let i = 0; i < 10; i++) {
      const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
      if (!this.codigosCortos.has(codigo)) return codigo;
    }
    throw new ConflictException('No se pudo generar un código, reintentá');
  }

  async obtenerAforo(
    sedeId: string,
  ): Promise<{ actual: number; maximo: number }> {
    const sede = await this.sedesRepo.findOne({ where: { id: sedeId } });
    if (!sede) throw new NotFoundException(`Sede ${sedeId} no encontrada`);

    const actual = await this.accesoRepo
      .createQueryBuilder('a')
      .where('a.sede_id = :sedeId', { sedeId })
      .andWhere('a.hora_egreso IS NULL')
      .getCount();

    return { actual, maximo: sede.aforoMaximo };
  }

  // Lista quiénes están DENTRO de una sede ahora mismo (sesión abierta,
  // hora_egreso IS NULL), con el que lleva más tiempo primero. Solo
  // lectura; el recepcionista queda limitado a su propia sede.
  // Paginado: en una sede concurrida la lista puede tener cientos de filas.
  async listarDentro(
    sedeId: string,
    currentUser: UsuarioAutenticado,
    query?: PaginationQueryDto,
  ): Promise<PaginatedResponse<ControlAcceso>> {
    assertSedeScope(currentUser, sedeId);
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const [data, total] = await this.accesoRepo.findAndCount({
      where: { sede: { id: sedeId }, horaEgreso: IsNull() },
      relations: { usuario: true },
      order: { horaIngreso: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // La cabecera se lee sin confiar en ella: solo decide con qué clave se
  // verifica, y cada camino fija su algoritmo (nunca 'none' ni otro).
  private verificarQr(qrToken: string): QrPayload {
    const invalido = new BadRequestException('QR inválido o expirado');
    const decodificado = this.jwtService.decode<{
      header?: { alg?: string };
    } | null>(qrToken, { complete: true });
    const alg = decodificado?.header?.alg;
    try {
      if (alg === 'ES256') {
        const publica = this.claves.claveVerificacion;
        if (!publica) throw invalido;
        return this.jwtService.verify<QrPayload>(qrToken, {
          secret: publica,
          algorithms: ['ES256'],
        });
      }
      if (alg === 'HS256') {
        return this.jwtService.verify<QrPayload>(qrToken, {
          algorithms: ['HS256'],
        });
      }
    } catch {
      throw invalido;
    }
    throw invalido;
  }

  obtenerClavePublica(): ClavePublicaQr {
    const clave = this.claves.publica;
    if (!clave) {
      throw new NotFoundException('No hay clave de acceso offline disponible');
    }
    return clave;
  }

  // Datos para validar QR sin conexión durante 24 h: clave pública, aforo,
  // quiénes están dentro y los socios con membresía vigente de toda la red.
  async obtenerSnapshot(
    sedeId: string,
    currentUser: UsuarioAutenticado,
  ): Promise<SnapshotAcceso> {
    assertSedeScope(currentUser, sedeId);
    const sede = await this.sedesRepo.findOne({ where: { id: sedeId } });
    if (!sede) throw new NotFoundException(`Sede ${sedeId} no encontrada`);
    const clave = this.claves.publica;
    if (!clave) {
      throw new NotFoundException('No hay clave de acceso offline disponible');
    }

    const hoy = hoyArgentina();
    const [actual, abiertas, membresias] = await Promise.all([
      this.accesoRepo
        .createQueryBuilder('a')
        .where('a.sede_id = :sedeId', { sedeId })
        .andWhere('a.hora_egreso IS NULL')
        .getCount(),
      this.accesoRepo
        .createQueryBuilder('a')
        .select('a.usuario_id', 'usuarioId')
        .where('a.hora_egreso IS NULL')
        .getRawMany<{ usuarioId: string }>(),
      this.membresiasRepo.find({
        where: {
          estado: EstadoMembresia.ACTIVO,
          fechaFin: MoreThan(hoy),
          usuario: { activo: true, tipoActor: TipoActor.SOCIO },
        },
        relations: { usuario: true },
        select: {
          id: true,
          estado: true,
          fechaInicio: true,
          fechaFin: true,
          usuario: { id: true, nombre: true, apellido: true },
        },
        order: { fechaInicio: 'ASC' },
      }),
    ]);

    // Una fila por socio: la vigente hoy y, si no tiene, la próxima.
    const porSocio = new Map<string, Membresia>();
    for (const m of membresias) {
      if (!esVigente(m, hoy) && !esProxima(m, hoy)) continue;
      // Orden por inicio: la vigente pisa a la anterior; la próxima solo entra
      // si el socio no tiene otra fila.
      if (esVigente(m, hoy) || !porSocio.has(m.usuario.id)) {
        porSocio.set(m.usuario.id, m);
      }
    }

    const generado = new Date();
    return {
      sedeId,
      generadoEn: generado.toISOString(),
      venceEn: new Date(generado.getTime() + SNAPSHOT_TTL_MS).toISOString(),
      clave,
      aforo: { actual, maximo: sede.aforoMaximo },
      dentro: abiertas.map((a) => a.usuarioId),
      socios: [...porSocio.values()].map((m) => ({
        id: m.usuario.id,
        nombre: m.usuario.nombre,
        apellido: m.usuario.apellido,
        desde: m.fechaInicio,
        hasta: m.fechaFin,
      })),
    };
  }

  // Verifica un QR emitido con ES256 ignorando solo la expiración (el ingreso
  // ocurrió offline, la sincronización llega después). null si no es válido.
  private verificarQrOffline(qrToken: string): QrOfflineVerificado | null {
    const clave = this.claves.publica;
    const pem = this.claves.claveVerificacion;
    if (!clave || !pem) return null;
    const dec = this.jwtService.decode<{
      header?: { alg?: string; kid?: string };
    } | null>(qrToken, { complete: true });
    if (dec?.header?.alg !== 'ES256' || dec.header.kid !== clave.kid) {
      return null;
    }
    let p: Partial<QrPayload> & { iat?: number };
    try {
      p = this.jwtService.verify<Partial<QrPayload> & { iat?: number }>(
        qrToken,
        { secret: pem, algorithms: ['ES256'], ignoreExpiration: true },
      );
    } catch {
      return null;
    }
    if (
      p.tipo !== 'qr-acceso' ||
      typeof p.usuarioId !== 'string' ||
      !UUID_RE.test(p.usuarioId) ||
      typeof p.jti !== 'string' ||
      !UUID_RE.test(p.jti) ||
      typeof p.iat !== 'number' ||
      typeof p.exp !== 'number'
    ) {
      return null;
    }
    return { usuarioId: p.usuarioId, jti: p.jti, iat: p.iat, exp: p.exp };
  }

  private async buscarEventoOffline(
    clientEventId: string,
  ): Promise<ResultadoSincronizacion | null> {
    const filas: Array<{
      estado: EstadoSincronizacion;
      codigo: string;
      acceso_id: string | null;
    }> = await this.accesoRepo.manager.query(SQL_BUSCAR_EVENTO, [
      clientEventId,
    ]);
    const previo = filas[0];
    if (!previo) return null;
    return {
      clientEventId,
      estado: previo.estado,
      codigo: 'YA_PROCESADO',
      ...(previo.acceso_id ? { accesoId: previo.acceso_id } : {}),
      mensaje: `Evento ya procesado antes (${previo.codigo})`,
    };
  }

  private paramsEvento(r: ResultadoOffline, accesoId: string | null) {
    return [
      r.clientEventId,
      r.sedeId,
      r.usuarioId,
      r.qrJti,
      r.ocurridoEn,
      r.estado,
      r.codigo,
      r.mensaje,
      accesoId,
    ];
  }

  private aResultado(r: ResultadoOffline): ResultadoSincronizacion {
    return {
      clientEventId: r.clientEventId,
      estado: r.estado,
      codigo: r.codigo,
      ...(r.accesoId ? { accesoId: r.accesoId } : {}),
      ...(r.mensaje ? { mensaje: r.mensaje } : {}),
    };
  }

  // Deja la fila del evento en una transacción nueva y corta (nunca sobre una
  // transacción abortada por un 23505). Si en el medio otro proceso tomó el
  // jti, se guarda sin él; si ganó el mismo clientEventId, se devuelve lo suyo.
  private async registrarResultadoOffline(
    r: ResultadoOffline,
  ): Promise<ResultadoSincronizacion> {
    try {
      await this.accesoRepo.manager.transaction((tx) =>
        tx.query(SQL_INSERTAR_EVENTO, this.paramsEvento(r, r.accesoId)),
      );
    } catch (err) {
      if (!esViolacionUnique(err)) throw err;
      if (restriccionViolada(err).includes('jti') && r.qrJti) {
        return this.registrarResultadoOffline({ ...r, qrJti: null });
      }
      const previo = await this.buscarEventoOffline(r.clientEventId);
      if (previo) return previo;
      throw err;
    }
    return this.aResultado(r);
  }

  private async membresiaPermiteAcceso(usuarioId: string): Promise<boolean> {
    const membresia = await obtenerVigente(this.membresiasRepo, usuarioId);
    return !!membresia && estadoDesde(membresia).puedeGenerarQr();
  }

  // Sincroniza los ingresos que el terminal registró sin conexión. Los fallos
  // por evento viajan dentro del resultado; el orden de la respuesta es el del
  // request, aunque se procesen por ocurridoEn.
  async sincronizarIngresosOffline(
    sedeId: string,
    eventos: EventoOfflineDto[],
    currentUser: UsuarioAutenticado,
  ): Promise<{ resultados: ResultadoSincronizacion[] }> {
    assertSedeScope(currentUser, sedeId);
    const sede = await this.sedesRepo.findOne({ where: { id: sedeId } });
    if (!sede) throw new NotFoundException(`Sede ${sedeId} no encontrada`);

    const orden = eventos
      .map((evento, indice) => ({ evento, indice }))
      .sort(
        (a, b) =>
          new Date(a.evento.ocurridoEn).getTime() -
            new Date(b.evento.ocurridoEn).getTime() || a.indice - b.indice,
      );
    const resultados: ResultadoSincronizacion[] = new Array(eventos.length);
    for (const { evento, indice } of orden) {
      resultados[indice] = await this.procesarEventoOffline(sedeId, evento);
    }
    return { resultados };
  }

  private async procesarEventoOffline(
    sedeId: string,
    evento: EventoOfflineDto,
  ): Promise<ResultadoSincronizacion> {
    // 1. Idempotencia: un evento ya procesado devuelve lo guardado y nada más.
    const previo = await this.buscarEventoOffline(evento.clientEventId);
    if (previo) return previo;

    const ahora = new Date();
    let ocurrido = new Date(evento.ocurridoEn);
    const base = {
      clientEventId: evento.clientEventId,
      sedeId,
      ocurridoEn: ocurrido,
      accesoId: null,
    };
    // Rechazos y conflictos no reservan el jti: otro evento válido del mismo
    // QR no debe quedar bloqueado por un envío mal formado.
    const rechazo = (
      codigo: string,
      mensaje: string,
      usuarioId: string | null = null,
    ) =>
      this.registrarResultadoOffline({
        ...base,
        usuarioId,
        qrJti: null,
        estado: 'RECHAZADO',
        codigo,
        mensaje,
      });

    // 2. Firma, algoritmo, kid y tipo.
    const qr = this.verificarQrOffline(evento.qrToken);
    if (!qr) return rechazo('TOKEN_INVALIDO', 'El QR no es válido');

    const usuario = await this.usuariosRepo.findOne({
      where: { id: qr.usuarioId },
    });

    // 3. Ventana de validez del QR, con tolerancia de reloj.
    const desde = qr.iat * 1000 - TOLERANCIA_RELOJ_MS;
    const hasta = qr.exp * 1000 + TOLERANCIA_RELOJ_MS;
    if (ocurrido.getTime() < desde || ocurrido.getTime() > hasta) {
      return rechazo(
        'QR_VENCIDO',
        'El ingreso ocurrió fuera de la ventana de validez del QR',
        usuario?.id ?? null,
      );
    }

    // 4. Fecha: demasiado vieja se rechaza; futura se acota a ahora.
    const observaciones: string[] = [];
    if (ocurrido.getTime() < ahora.getTime() - ANTIGUEDAD_MAXIMA_MS) {
      return rechazo(
        'FECHA_INVALIDA',
        'El ingreso tiene más de 72 horas de antigüedad',
        usuario?.id ?? null,
      );
    }
    if (ocurrido.getTime() > ahora.getTime()) {
      observaciones.push(
        `ocurridoEn en el futuro (${evento.ocurridoEn}): se registró con la hora de sincronización`,
      );
      ocurrido = ahora;
    }

    // 5. Usuario.
    if (!usuario) {
      return rechazo('USUARIO_INEXISTENTE', 'El usuario del QR no existe');
    }

    // Observaciones: el ingreso ya ocurrió, así que se registra igual.
    let codigoObservado: string | null = null;
    if (!usuario.activo || !(await this.membresiaPermiteAcceso(usuario.id))) {
      codigoObservado = 'MEMBRESIA_NO_VIGENTE';
      observaciones.push(
        'Membresía no vigente o usuario inactivo al sincronizar',
      );
    }
    const { actual, maximo } = await this.obtenerAforo(sedeId);
    if (actual >= maximo) {
      codigoObservado ??= 'AFORO_EXCEDIDO';
      observaciones.push('La sede superaba su aforo máximo al sincronizar');
    }
    const observacion = observaciones.length ? observaciones.join('. ') : null;

    const accesoId = randomUUID();
    const fila: ResultadoOffline = {
      ...base,
      ocurridoEn: new Date(evento.ocurridoEn),
      usuarioId: usuario.id,
      qrJti: qr.jti,
      estado: codigoObservado ? 'OBSERVADO' : 'CREADO',
      codigo: codigoObservado ?? 'OK',
      mensaje: observacion,
      accesoId,
    };

    // 6 y 7. Todo en una transacción: primero el evento (el índice único del
    // jti detecta el QR reusado), después el ingreso (el índice único parcial
    // detecta la sesión abierta).
    try {
      await this.accesoRepo.manager.transaction(async (tx) => {
        await tx.query(SQL_INSERTAR_EVENTO, this.paramsEvento(fila, null));
        await tx.query(SQL_INSERTAR_ACCESO, [
          accesoId,
          usuario.id,
          sedeId,
          ocurrido,
          ahora,
          observacion,
        ]);
        await tx.query(SQL_ENLAZAR_ACCESO, [evento.clientEventId, accesoId]);
      });
    } catch (err) {
      if (!esViolacionUnique(err)) throw err;
      // Un 23505 abortó la transacción: ya está revertida; el resultado se
      // registra en una nueva.
      const restriccion = restriccionViolada(err);
      const conflicto = (codigo: string, mensaje: string, jti: string | null) =>
        this.registrarResultadoOffline({
          ...fila,
          qrJti: jti,
          estado: 'CONFLICTO',
          codigo,
          mensaje,
          accesoId: null,
        });
      if (restriccion.includes('jti')) {
        return conflicto('QR_REUSADO', 'Este QR ya fue registrado', null);
      }
      if (restriccion.includes('uq_acceso_abierto')) {
        return conflicto(
          'SESION_ABIERTA',
          'El usuario ya tiene un ingreso abierto',
          qr.jti,
        );
      }
      // Carrera por el mismo clientEventId: gana quien llegó primero.
      const ganador = await this.buscarEventoOffline(evento.clientEventId);
      if (ganador) return ganador;
      throw err;
    }
    return this.aResultado(fila);
  }

  // RN01 + RF04/RF05: valida el QR, chequea aforo, y ahora también
  // que el recepcionista que valida pertenezca a ESA sede (o sea Gerente).
  async validarIngreso(
    qrToken: string,
    sedeId: string,
    currentUser: UsuarioAutenticado,
  ): Promise<ControlAcceso> {
    const payload = this.verificarQr(qrToken);
    if (payload.tipo !== 'qr-acceso') {
      throw new BadRequestException('QR inválido');
    }

    // Un solo uso: el jti se reserva antes de cualquier await, así dos
    // lecturas simultáneas del mismo QR no pueden pasar las dos. Si la
    // validación falla (aforo, membresía, otra sede) se libera para reintentar.
    const jti = payload.jti;
    if (jti) {
      this.purgarCodigosExpirados();
      if (this.qrUsados.has(jti)) {
        throw new ConflictException(
          'Este QR ya fue usado. Pedile al socio que lo actualice',
        );
      }
      this.qrUsados.set(
        jti,
        payload.exp ? payload.exp * 1000 : Date.now() + CODIGO_CORTO_TTL_MS,
      );
    }

    try {
      return await this.registrarIngresoValidado(
        payload.usuarioId,
        sedeId,
        currentUser,
        'Usuario del QR no encontrado',
        'QR',
      );
    } catch (err) {
      if (jti) this.qrUsados.delete(jti);
      throw err;
    }
  }

  // Alternativa práctica al token largo: código de 6 dígitos de un solo
  // uso, con la misma expiración de 60 segundos que el QR.
  async validarCodigo(
    codigo: string,
    sedeId: string,
    currentUser: UsuarioAutenticado,
  ): Promise<ControlAcceso> {
    const entrada = this.codigosCortos.get(codigo);
    if (!entrada || entrada.expiraEnMs <= Date.now()) {
      if (entrada) this.codigosCortos.delete(codigo);
      throw new BadRequestException('Código inválido o expirado');
    }

    const registro = await this.registrarIngresoValidado(
      entrada.usuarioId,
      sedeId,
      currentUser,
      'Usuario del código no encontrado',
      'CODIGO',
    );
    // Un solo uso: recién se borra con la validación exitosa.
    this.codigosCortos.delete(codigo);
    return registro;
  }

  // Lógica compartida de validación de ingreso (sede-scope, membresía,
  // aforo, RN-01 y registro). Recibe el usuarioId ya resuelto — sea
  // desde el JWT del QR o desde el código corto.
  private async registrarIngresoValidado(
    usuarioId: string,
    sedeId: string,
    currentUser: UsuarioAutenticado,
    mensajeUsuarioNoEncontrado: string,
    metodo: MetodoIngreso,
  ): Promise<ControlAcceso> {
    assertSedeScope(currentUser, sedeId);

    const usuario = await this.usuariosRepo.findOne({
      where: { id: usuarioId },
    });
    if (!usuario) throw new NotFoundException(mensajeUsuarioNoEncontrado);
    if (!usuario.activo) throw new BadRequestException('Usuario inactivo');

    // Defensa en profundidad: el código pudo generarse cuando la membresía
    // estaba activa y vencer en los 60 segundos intermedios.
    await this.exigirSocioConMembresiaActiva(usuario);

    const sede = await this.sedesRepo.findOne({ where: { id: sedeId } });
    if (!sede) throw new NotFoundException(`Sede ${sedeId} no encontrada`);

    const { actual, maximo } = await this.obtenerAforo(sedeId);
    if (actual >= maximo) {
      throw new ConflictException('La sede alcanzó su aforo máximo');
    }

    const sesionAbierta = await this.accesoRepo
      .createQueryBuilder('a')
      .where('a.usuario_id = :usuarioId', { usuarioId: usuario.id })
      .andWhere('a.hora_egreso IS NULL')
      .getOne();

    if (sesionAbierta) {
      throw new ConflictException(
        'El usuario ya tiene un ingreso abierto en otra sede (o en esta misma sin egreso registrado)',
      );
    }

    const registro = this.accesoRepo.create({
      usuario,
      sede,
      metodoIngreso: metodo,
    });
    try {
      return await this.accesoRepo.save(registro);
    } catch (err) {
      // RN-01 en la base: el índice único parcial uq_acceso_abierto_por_usuario
      // rechaza un segundo ingreso abierto cuando dos validaciones simultáneas
      // superan juntas el chequeo de arriba. Vale para QR, código y DNI.
      if (esViolacionUnique(err)) {
        throw new ConflictException(
          'El usuario ya tiene un ingreso abierto en otra sede (o en esta misma sin egreso registrado)',
        );
      }
      throw err;
    }
  }

  // Socio activo por DNI. Un DNI inexistente y el de alguien que no es socio
  // dan el mismo 404: la búsqueda no revela datos de otros tipos de usuario.
  private async buscarSocioPorDni(dni: string): Promise<Usuario> {
    const usuario = await this.usuariosRepo.findOne({ where: { dni } });
    if (!usuario || usuario.tipoActor !== TipoActor.SOCIO) {
      throw new NotFoundException('No existe un socio con ese DNI');
    }
    if (!usuario.activo) throw new BadRequestException('Usuario inactivo');
    return usuario;
  }

  // Previsualización del ingreso manual por DNI: solo nombre, foto y estado
  // de la membresía. No registra nada.
  async buscarPorDni(
    dni: string,
    sedeId: string,
    currentUser: UsuarioAutenticado,
  ): Promise<VistaPreviaSocio> {
    assertSedeScope(currentUser, sedeId);
    const usuario = await this.buscarSocioPorDni(dni);

    const membresias = await this.membresiasRepo.find({
      where: { usuario: { id: usuario.id } },
    });
    const hoy = hoyArgentina();
    let estadoMembresia: EstadoMembresiaVista = 'SIN_MEMBRESIA';
    if (membresias.some((m) => esVigente(m, hoy))) estadoMembresia = 'VIGENTE';
    else if (membresias.some((m) => esProxima(m, hoy)))
      estadoMembresia = 'PROXIMA';
    else if (membresias.some((m) => m.estado === EstadoMembresia.SUSPENDIDO))
      estadoMembresia = 'SUSPENDIDA';
    else if (membresias.length > 0) estadoMembresia = 'VENCIDA';

    return {
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      fotoUrl: usuario.fotoUrl ?? null,
      estadoMembresia,
    };
  }

  // Ingreso manual por DNI, cuando el socio no puede mostrar su QR. Pasa por
  // la misma lógica que el QR y el código corto (sede, vigencia, aforo, RN01).
  async validarDni(
    dni: string,
    sedeId: string,
    currentUser: UsuarioAutenticado,
  ): Promise<ControlAcceso> {
    assertSedeScope(currentUser, sedeId);
    const usuario = await this.buscarSocioPorDni(dni);
    // El 23505 de RN01 ya lo traduce a 409 registrarIngresoValidado.
    return this.registrarIngresoValidado(
      usuario.id,
      sedeId,
      currentUser,
      'Socio no encontrado',
      'DNI',
    );
  }

  // Ahora recibe currentUser para validar que el recepcionista que cierra
  // la sesión pertenezca a la sede donde el usuario está registrado como
  // "dentro". Un Gerente puede hacerlo desde cualquier sede.
  async registrarEgreso(
    usuarioId: string,
    currentUser: UsuarioAutenticado,
  ): Promise<ControlAcceso> {
    const sesionAbierta = await this.accesoRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.sede', 'sede')
      .where('a.usuario_id = :usuarioId', { usuarioId })
      .andWhere('a.hora_egreso IS NULL')
      .getOne();

    if (!sesionAbierta) {
      throw new NotFoundException('El usuario no tiene ningún ingreso abierto');
    }

    assertSedeScope(currentUser, sesionAbierta.sede.id);

    sesionAbierta.horaEgreso = new Date();
    return this.accesoRepo.save(sesionAbierta);
  }

  // Agregado de solo lectura para la Gerencia: métricas de accesos por
  // sede. GG ve todas las activas; GS solo la suya (403 sin sede).
  // Reusa el criterio de obtenerAforo (hora_egreso IS NULL) para el aforo actual.
  async obtenerResumenAccesos(
    currentUser: UsuarioAutenticado,
  ): Promise<ResumenAccesos> {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    const esGG = currentUser.tipoActor === TipoActor.GERENTE_GENERAL;
    if (!esGG && !currentUser.sedeId) {
      throw new ForbiddenException('Tu usuario no tiene una sede asignada');
    }

    const sedes = await this.sedesRepo.find({
      where: esGG ? { activa: true } : { id: currentUser.sedeId as string },
      order: { nombre: 'ASC' },
    });

    const porSede: ResumenAccesoSede[] = [];
    for (const sede of sedes) {
      const [aforoActual, ingresosHoy, egresosHoy] = await Promise.all([
        this.accesoRepo
          .createQueryBuilder('a')
          .where('a.sede_id = :sedeId', { sedeId: sede.id })
          .andWhere('a.hora_egreso IS NULL')
          .getCount(),
        this.accesoRepo
          .createQueryBuilder('a')
          .where('a.sede_id = :sedeId', { sedeId: sede.id })
          .andWhere('a.hora_ingreso >= :inicioHoy', { inicioHoy })
          .getCount(),
        this.accesoRepo
          .createQueryBuilder('a')
          .where('a.sede_id = :sedeId', { sedeId: sede.id })
          .andWhere('a.hora_egreso >= :inicioHoy', { inicioHoy })
          .getCount(),
      ]);
      porSede.push({
        sedeId: sede.id,
        sede: sede.nombre,
        aforoActual,
        aforoMaximo: sede.aforoMaximo,
        ingresosHoy,
        egresosHoy,
      });
    }

    return {
      porSede,
      totalIngresosHoy: porSede.reduce((acc, s) => acc + s.ingresosHoy, 0),
      totalEgresosHoy: porSede.reduce((acc, s) => acc + s.egresosHoy, 0),
    };
  }

  async findHistorialPorUsuario(
    usuarioId: string,
    query: PaginationQueryDto,
    sedeId?: string,
  ): Promise<PaginatedResponse<ControlAcceso>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await this.accesoRepo.findAndCount({
      where: {
        usuario: { id: usuarioId },
        ...(sedeId ? { sede: { id: sedeId } } : {}),
      },
      relations: { sede: true },
      order: { horaIngreso: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
