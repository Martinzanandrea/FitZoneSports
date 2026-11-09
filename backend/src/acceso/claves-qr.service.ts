import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type JsonWebKey,
  type KeyObject,
} from 'crypto';

export interface ClavePublicaQr {
  kid: string;
  alg: 'ES256';
  jwk: JsonWebKey;
}

// Par de claves ES256 (P-256) con el que se firma el QR de acceso. La pública
// se publica como JWK para que el terminal verifique el QR sin servidor.
// Sin clave configurada queda "no disponible" y el QR sigue firmándose HS256.
@Injectable()
export class ClavesQrService {
  private readonly logger = new Logger(ClavesQrService.name);
  private privadaPem: string | null = null;
  private publicaPem: string | null = null;
  private clavePublica: ClavePublicaQr | null = null;

  constructor(config: ConfigService) {
    const pem = config.get<string>('QR_PRIVATE_KEY')?.trim();
    if (pem) {
      // En variables de entorno el PEM suele venir en una línea con "\n" literales.
      this.cargar(createPrivateKey(pem.replace(/\\n/g, '\n')), config);
    } else if (config.get<string>('QR_CLAVE_EFIMERA') === 'true') {
      const { privateKey } = generateKeyPairSync('ec', {
        namedCurve: 'P-256',
      });
      this.cargar(privateKey, config);
      this.logger.warn(
        'QR_PRIVATE_KEY no está definida: se generó un par de claves efímero. ' +
          'Los QR y los snapshots anteriores dejan de valer al reiniciar.',
      );
    } else {
      this.logger.log(
        'Sin clave ES256 para el QR: se firma con HS256 y el acceso offline no está disponible',
      );
    }
  }

  private cargar(privada: KeyObject, config: ConfigService): void {
    const publica = createPublicKey(privada);
    const jwk = publica.export({ format: 'jwk' });
    const kid =
      config.get<string>('QR_KEY_ID')?.trim() ||
      createHash('sha256')
        .update(JSON.stringify(jwk))
        .digest('hex')
        .slice(0, 8);
    this.privadaPem = privada.export({ type: 'pkcs8', format: 'pem' }) as string;
    this.publicaPem = publica.export({ type: 'spki', format: 'pem' }) as string;
    this.clavePublica = { kid, alg: 'ES256', jwk };
  }

  get disponible(): boolean {
    return this.privadaPem !== null;
  }

  // PEM para firmar y verificar con JwtService; nunca se registra ni se expone.
  get clavePrivada(): string | null {
    return this.privadaPem;
  }

  get claveVerificacion(): string | null {
    return this.publicaPem;
  }

  // Clave pública como JWK; null si no hay clave ES256.
  get publica(): ClavePublicaQr | null {
    return this.clavePublica;
  }
}
