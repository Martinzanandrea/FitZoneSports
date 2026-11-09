import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class RechazarCamposSensibleInterceptor implements NestInterceptor {
  private readonly prohibidos = ['tipoActor', 'sedeId', 'dni'];

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const body = context.switchToHttp().getRequest().body as
      Record<string, unknown> | undefined;
    const presentes = this.prohibidos.filter(
      (campo) => body?.[campo] !== undefined,
    );
    if (presentes.length > 0) {
      throw new BadRequestException(
        `Campos no permitidos en este endpoint: ${presentes.join(', ')}. Usá los endpoints dedicados.`,
      );
    }
    return next.handle();
  }
}
