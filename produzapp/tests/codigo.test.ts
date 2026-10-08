import { describe, expect, it } from 'vitest';
import { interpretar, normalizar } from '../src/dominio/codigo.js';

describe('normalizar', () => {
  it('põe em maiúsculas e tira espaços', () => {
    expect(normalizar('  00034-05-emb ')).toEqual({ codigo: '00034-05-EMB', colado: false });
  });
  it('desfaz leitura colada 2x e 3x (leitor sem Enter)', () => {
    expect(normalizar('00031-01-EMB00031-01-EMB00031-01-EMB')).toEqual({ codigo: '00031-01-EMB', colado: true });
    expect(normalizar('00031-01-EMB00031-01-EMB')).toEqual({ codigo: '00031-01-EMB', colado: true });
  });
});

describe('interpretar', () => {
  it('OP-CAIXA-SIGLA completa com zeros', () => {
    expect(interpretar('034-5-EMB')).toEqual({ tipo: 'caixa', op: '00034', caixa: '05', sigla: 'EMB' });
  });
  it('OP-SIGLA', () => {
    expect(interpretar('00034-EXP')).toEqual({ tipo: 'op', op: '00034', sigla: 'EXP' });
  });
  it('parada e retomada', () => {
    expect(interpretar('PARADA-PES-QUEBRA-AGULHA')).toEqual({ tipo: 'parada', sigla: 'PES', motivo: 'QUEBRA AGULHA' });
    expect(interpretar('RETOMA-PES')).toEqual({ tipo: 'retoma', sigla: 'PES' });
  });
  it('sigla que não existe mais (AVI) é reconhecida como desconhecida', () => {
    expect(interpretar('00034-05-AVI')).toEqual({ tipo: 'sigla_desconhecida', sigla: 'AVI' });
  });
  it('lixo é inválido', () => {
    expect(interpretar('XYZ')).toEqual({ tipo: 'invalido' });
  });
});
