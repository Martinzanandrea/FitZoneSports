import { beforeEach, describe, expect, it } from 'vitest';
import { TipoActor } from '../../shared/types/enums';
import type { UsuarioAutenticado } from './auth.types';
import {
  VIGENCIA_COPIA_MS,
  borrarUsuarioLocal,
  guardarUsuarioLocal,
  interpretarCopiaLocal,
  leerUsuarioLocal,
} from './sesionLocal';

const AHORA = Date.parse('2026-10-09T18:00:00Z');
const usuario: UsuarioAutenticado = {
  id: 'u1',
  nombre: 'Rita',
  apellido: 'Recepción',
  tipoActor: TipoActor.RECEPCIONISTA,
  sedeId: 'sA',
};
const copia = (sobre: object = {}, guardadoEn = AHORA) => JSON.stringify({ usuario, guardadoEn, ...sobre });

beforeEach(() => localStorage.clear());

describe('interpretarCopiaLocal', () => {
  it('una copia reciente y bien formada devuelve el usuario', () => {
    expect(interpretarCopiaLocal(copia(), AHORA + 1000)).toEqual(usuario);
  });

  it('acepta sedeId null', () => {
    const u = { ...usuario, sedeId: null };
    expect(interpretarCopiaLocal(copia({ usuario: u }), AHORA)).toEqual(u);
  });

  it('una copia de 24 h o más se descarta', () => {
    expect(interpretarCopiaLocal(copia(), AHORA + VIGENCIA_COPIA_MS - 1)).toEqual(usuario);
    expect(interpretarCopiaLocal(copia(), AHORA + VIGENCIA_COPIA_MS)).toBeNull();
  });

  it('una copia con fecha futura se descarta', () => {
    expect(interpretarCopiaLocal(copia({}, AHORA + 60_000), AHORA)).toBeNull();
  });

  it.each([
    ['null', null],
    ['vacío', ''],
    ['no es JSON', '{roto'],
    ['sin usuario', JSON.stringify({ guardadoEn: AHORA })],
    ['sin fecha', JSON.stringify({ usuario })],
    ['rol inexistente', copia({ usuario: { ...usuario, tipoActor: 'ADMIN_TOTAL' } })],
    ['id que no es string', copia({ usuario: { ...usuario, id: 7 } })],
    ['sedeId inválido', copia({ usuario: { ...usuario, sedeId: 5 } })],
  ])('%s: null', (_n, texto) => {
    expect(interpretarCopiaLocal(texto, AHORA)).toBeNull();
  });

  it('ignora campos de más (no se arrastran datos que no son del usuario)', () => {
    const leido = interpretarCopiaLocal(copia({ usuario: { ...usuario, token: 'secreto', email: 'a@b.c' } }), AHORA);
    expect(leido).toEqual(usuario);
  });
});

describe('copia local en localStorage', () => {
  it('guarda, lee y borra', () => {
    expect(leerUsuarioLocal()).toBeNull();
    guardarUsuarioLocal(usuario);
    expect(leerUsuarioLocal()).toEqual(usuario);
    borrarUsuarioLocal();
    expect(leerUsuarioLocal()).toBeNull();
  });

  it('guarda solo los campos del usuario, nunca tokens ni datos de contacto', () => {
    guardarUsuarioLocal({ ...usuario, token: 'secreto', email: 'a@b.c', dni: '1' } as UsuarioAutenticado);
    const crudo = localStorage.getItem('fitzone-usuario-local') ?? '';
    expect(crudo).not.toMatch(/secreto|a@b\.c|dni/);
    expect(Object.keys(JSON.parse(crudo).usuario).sort()).toEqual(['apellido', 'id', 'nombre', 'sedeId', 'tipoActor']);
  });
});
