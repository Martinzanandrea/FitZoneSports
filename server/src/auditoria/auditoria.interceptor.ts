import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDITABLE_KEY, AuditableMeta } from './decorators/auditable.decorator';
import { AuditoriaService } from './auditoria.service';

@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditableMeta>(AUDITABLE_KEY, context.getHandler());
    if (!meta) return next.handle();
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    return next.handle().pipe(
      tap((response: any) => {
        void this.auditoriaService.registrar({
          actorId: user?.id,
          accion: meta.accion,
          entidad: meta.entidad,
          entidadId: response?.id,
          detalle: request.body,
        });
      }),
    );
  }
}
