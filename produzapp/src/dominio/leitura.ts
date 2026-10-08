import { randomUUID } from 'node:crypto';
import type { Repositorio } from '../repositorio/repositorio.js';
import type { EventoEtapa, OrdemProducao, ResultadoLeitura } from './tipos.js';
import { ETAPAS, TOTAL_ETAPAS, indiceEtapa, nomeEtapa, ehSigla } from './etapas.js';
import { interpretar, normalizar } from './codigo.js';

export interface ConfigLeitura {
  /** Se verdadeiro, ler uma etapa pulando a anterior é recusado. */
  bloquearForaDeSequencia: boolean;
  paresPadrao: number;
}

export const CONFIG_PADRAO: ConfigLeitura = { bloquearForaDeSequencia: true, paresPadrao: 20 };

export interface EntradaLeitura {
  codigo: string;
  /** Sigla da estação que leu (COR, PES, ...). */
  estacao: string;
  /** Identificador único da leitura: reenviar o mesmo id nunca duplica a baixa. */
  idLeitura?: string;
  operador?: string;
}

const AVISO_COLADO = 'Leitura colada: configure o Enter (CR) no leitor.';

/**
 * Regras de uma leitura. Grava primeiro no repositório local; envio aos sistemas
 * externos acontece depois, pela fila (ver sincronizacao.ts).
 */
export async function processarLeitura(
  repo: Repositorio,
  entrada: EntradaLeitura,
  config: ConfigLeitura = CONFIG_PADRAO,
  agora: Date = new Date(),
): Promise<ResultadoLeitura> {
  const idLeitura = entrada.idLeitura ?? randomUUID();

  // Idempotência: mesma leitura reenviada devolve o resultado já gravado.
  const anterior = await repo.buscarLeitura(idLeitura);
  if (anterior) return anterior;

  const resultado = await decidir(repo, { ...entrada, idLeitura }, config, agora);
  await repo.guardarLeitura(resultado);
  return resultado;
}

async function decidir(
  repo: Repositorio,
  entrada: EntradaLeitura & { idLeitura: string },
  config: ConfigLeitura,
  agora: Date,
): Promise<ResultadoLeitura> {
  const { idLeitura } = entrada;
  const { codigo, colado } = normalizar(entrada.codigo);
  const aviso = colado ? AVISO_COLADO : undefined;
  const falha = (status: ResultadoLeitura['status'], mensagem: string, extra: Partial<ResultadoLeitura> = {}): ResultadoLeitura =>
    ({ idLeitura, status, mensagem, aviso, ...extra });

  if (!codigo) return falha('erro', 'Leitura vazia.');
  if (!ehSigla(entrada.estacao)) return falha('erro', `Estação "${entrada.estacao}" não existe.`);

  const lido = interpretar(codigo);

  switch (lido.tipo) {
    case 'invalido':
      return falha('erro', 'Formato não reconhecido. Use OP-CAIXA-SIGLA, ex.: 00034-05-EMB');
    case 'sigla_desconhecida':
      return falha('erro', `Sigla de etapa "${lido.sigla}" não existe.`);
  }

  if (lido.sigla !== entrada.estacao) {
    return falha(
      'fora_da_estacao',
      `Este código é de ${nomeEtapa(lido.sigla)}, mas esta estação é ${nomeEtapa(entrada.estacao)}.`,
    );
  }

  // ---- Paradas ----
  if (lido.tipo === 'parada') {
    const aberta = await repo.paradaAberta(lido.sigla);
    if (aberta) return falha('repetida', `Já existe parada aberta em ${nomeEtapa(lido.sigla)} (${aberta.motivo}).`);
    await repo.abrirParada({ id: randomUUID(), sigla: lido.sigla, motivo: lido.motivo, inicio: agora, operador: entrada.operador });
    return falha('parada_aberta', `Parada aberta em ${nomeEtapa(lido.sigla)}: ${lido.motivo}.`);
  }
  if (lido.tipo === 'retoma') {
    const aberta = await repo.paradaAberta(lido.sigla);
    if (!aberta) return falha('erro', `Não há parada aberta em ${nomeEtapa(lido.sigla)}.`);
    await repo.fecharParada(aberta.id, agora);
    const min = Math.round((agora.getTime() - aberta.inicio.getTime()) / 60000);
    return falha('parada_encerrada', `${nomeEtapa(lido.sigla)} voltou a produzir (parada de ${min} min).`);
  }

  // ---- Etapa de uma OP ----
  let ordem: OrdemProducao | undefined;
  if (lido.tipo === 'caixa') {
    ordem = await repo.buscarOrdemPorCodigo(lido.op, lido.caixa);
    if (!ordem) return falha('erro', `OP ${lido.op} caixa ${lido.caixa} não encontrada.`);
  } else {
    const candidatas = await repo.buscarOrdensPorOp(lido.op);
    if (candidatas.length === 0) return falha('erro', `OP ${lido.op} não encontrada.`);
    if (candidatas.length > 1) return falha('erro', `OP ${lido.op} tem várias caixas: leia o código com a caixa (OP-CAIXA-SIGLA).`);
    ordem = candidatas[0]!;
  }

  const eventos = await repo.eventosDaOrdem(ordem.id);
  const feitas = eventos.length;
  const idx = indiceEtapa(lido.sigla);

  if (idx < feitas) {
    return falha('repetida', `${nomeEtapa(lido.sigla)} já registrada nesta caixa.`, { ordemId: ordem.id, pares: ordem.pares });
  }
  if (idx > feitas && config.bloquearForaDeSequencia) {
    return falha('fora_de_sequencia', `Falta ler ${nomeEtapa(ETAPAS[feitas]!.sigla)} antes de ${nomeEtapa(lido.sigla)}.`, {
      ordemId: ordem.id,
    });
  }

  const evento: EventoEtapa = {
    id: randomUUID(),
    ordemId: ordem.id,
    sigla: lido.sigla,
    em: agora,
    estacao: entrada.estacao,
    operador: entrada.operador,
    idLeitura,
    colado,
  };
  await repo.adicionarEvento(evento);

  const concluida = feitas + 1 >= TOTAL_ETAPAS && idx === TOTAL_ETAPAS - 1;
  if (feitas === 0) {
    await repo.enfileirar({
      id: randomUUID(), destino: 'bling', tipo: 'op.iniciada', criadoEm: agora, tentativas: 0,
      proximaTentativa: agora, status: 'pendente',
      payload: { ordemId: ordem.id, op: ordem.op, caixa: ordem.caixa, pares: ordem.pares, em: agora.toISOString() },
    });
  }
  if (concluida) {
    await repo.enfileirar({
      id: randomUUID(), destino: 'bling', tipo: 'op.concluida', criadoEm: agora, tentativas: 0,
      proximaTentativa: agora, status: 'pendente',
      payload: { ordemId: ordem.id, op: ordem.op, caixa: ordem.caixa, pares: ordem.pares, em: agora.toISOString() },
    });
  }

  const progresso = `${feitas + 1}/${TOTAL_ETAPAS}`;
  return {
    idLeitura, status: 'ok', aviso, ordemId: ordem.id, pares: ordem.pares, concluida,
    mensagem: concluida
      ? `OP ${ordem.op} · caixa ${ordem.caixa} CONCLUÍDA (${ordem.pares} pares expedidos).`
      : `OK · ${ordem.pares} pares · ${nomeEtapa(lido.sigla)} (${progresso})`,
  };
}
