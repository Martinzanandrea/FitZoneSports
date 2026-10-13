import { Injectable } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EnvioNotificacion, Notificacion, Sede, Usuario } from '../entities';
import { ENVIADOR_CORREO } from '../common/mail/enviador-correo';
import { MailModule } from '../common/mail/mail.module';
import { NotificacionesModule } from './notificaciones.module';
import { NotificacionesService } from './notificaciones.service';
import { EmailNotificador } from './notificadores/email.notificador';
import { NotificadorFactory } from './notificadores/notificador.factory';
import { PanelNotificador } from './notificadores/panel.notificador';
import {
  CanalNotificacion,
  NOTIFICADORES,
  TipoNotificacion,
  type Destinatario,
  type MensajeNotificacion,
  type Notificador,
} from './notificaciones.types';

// Canal de prueba: NO existe en producción ni en el enum real. Se usa un valor
// propio con un cast, sin modificar CanalNotificacion, porque la fábrica y el
// servicio solo trabajan con el `canal` que cada notificador declara.
const CANAL_SMS = 'SMS_PRUEBA' as CanalNotificacion;
const PAUSA_SMS_MS = 777;

@Injectable()
class SmsNotificadorFalso implements Notificador {
  readonly canal = CANAL_SMS;
  readonly pausaMs = PAUSA_SMS_MS;
  readonly enviados: string[] = [];

  // Elegible solo si el nombre empieza con "Con" (simula "tiene celular").
  puedeNotificar(d: Destinatario): boolean {
    return d.nombre.startsWith('Con');
  }

  enviar(d: Destinatario): Promise<boolean> {
    this.enviados.push(d.id);
    return Promise.resolve(d.id !== 'falla');
  }
}

const msg: MensajeNotificacion = {
  tipo: TipoNotificacion.AVISO_GENERAL,
  titulo: 'Aviso',
  mensaje: 'Hola',
};
const dest = (id: string, nombre: string): Destinatario => ({
  id,
  nombre,
  email: `${id}@ejemplo.com`,
  emailVerificado: true,
});

describe('Extensibilidad: un canal nuevo sin tocar fábrica ni servicio', () => {
  async function armar() {
    const notifRepo = {
      create: jest.fn((x: unknown) => x),
      save: jest.fn().mockResolvedValue(undefined),
    };
    // Mismo cableado que NotificacionesModule: providers + token NOTIFICADORES.
    // La fábrica y el servicio son las clases reales, sin ninguna edición.
    const modulo = await Test.createTestingModule({
      providers: [
        NotificacionesService,
        NotificadorFactory,
        PanelNotificador,
        EmailNotificador,
        SmsNotificadorFalso,
        {
          provide: NOTIFICADORES,
          useFactory: (
            panel: PanelNotificador,
            email: EmailNotificador,
            sms: SmsNotificadorFalso,
          ) => [panel, email, sms],
          inject: [PanelNotificador, EmailNotificador, SmsNotificadorFalso],
        },
        { provide: ENVIADOR_CORREO, useValue: { enviar: jest.fn() } },
        { provide: getRepositoryToken(Notificacion), useValue: notifRepo },
        { provide: getRepositoryToken(EnvioNotificacion), useValue: {} },
        { provide: getRepositoryToken(Usuario), useValue: {} },
        { provide: getRepositoryToken(Sede), useValue: {} },
      ],
    }).compile();
    const service = modulo.get(NotificacionesService);
    const esperar = jest
      .spyOn(service as unknown as { esperar: () => Promise<void> }, 'esperar')
      .mockResolvedValue(undefined);
    return {
      service,
      esperar,
      sms: modulo.get(SmsNotificadorFalso),
      factory: modulo.get(NotificadorFactory),
    };
  }

  it('la fábrica entrega el notificador nuevo y lo lista como disponible', async () => {
    const { factory, sms } = await armar();
    expect(factory.crear(CANAL_SMS)).toBe(sms);
    expect(factory.canalesDisponibles()).toContain(CANAL_SMS);
  });

  it('enviarLote lo usa, respeta puedeNotificar y pausaMs, y acumula su resultado', async () => {
    const { service, esperar, sms } = await armar();
    const r = await service.notificar(
      [
        dest('a', 'Con celular A'),
        dest('b', 'Sin celular'),
        dest('falla', 'Con celular F'),
        dest('c', 'Con celular C'),
      ],
      msg,
      [CANAL_SMS],
    );
    // 'b' no es elegible: no se intenta ni cuenta como fallido.
    expect(sms.enviados).toEqual(['a', 'falla', 'c']);
    expect(r.porCanal[CANAL_SMS]).toEqual({
      enviados: 2,
      fallidos: 1,
      omitidos: 1,
    });
    // Tres envíos efectivos: dos pausas del valor que declara el notificador.
    expect(esperar).toHaveBeenCalledTimes(2);
    expect(esperar).toHaveBeenCalledWith(PAUSA_SMS_MS);
  });

  it('convive con los canales existentes en el mismo lote', async () => {
    const { service, sms } = await armar();
    const r = await service.notificar([dest('a', 'Con celular A')], msg, [
      CanalNotificacion.PANEL,
      CANAL_SMS,
    ]);
    expect(sms.enviados).toEqual(['a']);
    expect(Object.keys(r.porCanal).sort()).toEqual(
      [CanalNotificacion.PANEL, CANAL_SMS].sort(),
    );
  });
});

describe('NotificacionesModule: el grafo de inyección resuelve', () => {
  it('compila con MailModule real y EnviadorCorreo mockeado (token NOTIFICADORES incluido)', async () => {
    const enviar = jest.fn().mockResolvedValue(undefined);
    const modulo = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        NotificacionesModule,
      ],
    })
      // Sin base de datos: se reemplazan solo los repositorios de TypeORM.
      .overrideProvider(getRepositoryToken(Notificacion))
      .useValue({ create: jest.fn(), save: jest.fn() })
      .overrideProvider(getRepositoryToken(EnvioNotificacion))
      .useValue({})
      .overrideProvider(getRepositoryToken(Usuario))
      .useValue({})
      .overrideProvider(getRepositoryToken(Sede))
      .useValue({})
      // MailModule es el real; solo el proveedor final se reemplaza por un mock.
      .overrideProvider(ENVIADOR_CORREO)
      .useValue({ enviar })
      .compile();

    expect(modulo.get(NotificacionesService)).toBeInstanceOf(
      NotificacionesService,
    );
    const factory = modulo.get(NotificadorFactory);
    expect(factory.canalesDisponibles()).toEqual([
      CanalNotificacion.PANEL,
      CanalNotificacion.EMAIL,
    ]);
    const email = factory.crear(CanalNotificacion.EMAIL);
    expect(email).toBeInstanceOf(EmailNotificador);
    expect(modulo.get(NOTIFICADORES)).toHaveLength(2);

    // El EmailNotificador del módulo usa el EnviadorCorreo inyectado.
    await email.enviar(dest('a', 'Ana'), msg);
    expect(enviar).toHaveBeenCalledWith(
      expect.objectContaining({ para: 'a@ejemplo.com' }),
    );
  });

  it('MailModule real forma parte del grafo (importado, sin ciclos)', () => {
    const imports = Reflect.getMetadata(
      'imports',
      NotificacionesModule,
    ) as unknown[];
    expect(imports).toContain(MailModule);
  });
});
