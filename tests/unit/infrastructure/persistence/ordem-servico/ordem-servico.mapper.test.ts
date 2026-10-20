import { describe, expect, it } from 'bun:test';
import { DomainError } from '@domain/core/domain-error';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import * as OrdemServicoMapper from '@infrastructure/persistence/ordem-servico/ordem-servico.mapper';

const em = (minutos: number) => new Date(Date.UTC(2026, 0, 10, 10, minutos));

/** Percorre o fluxo inteiro, de Recebida até Entregue, com horários conhecidos. */
function osEntregue(): OrdemServico {
  const os = OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' }, em(0));
  os.iniciarDiagnostico(em(1));
  os.incluirServico({ servicoId: 's1', precoUnitario: Dinheiro.deCentavos(15000) }, em(2));
  os.incluirServico({ servicoId: 's2', precoUnitario: Dinheiro.deCentavos(9000) }, em(2));
  os.incluirPeca({ pecaId: 'p1', quantidade: Quantidade.de(2), precoUnitario: Dinheiro.deCentavos(4000) }, em(3));
  os.gerarOrcamento(em(4));
  os.enviarOrcamento(em(5));
  os.aprovarOrcamento(em(6));
  os.finalizar(em(30));
  os.entregar(em(40));
  return os;
}

const ida = (os: OrdemServico) => {
  const { escalares, itensServico, itensPeca, historico } = OrdemServicoMapper.paraGravacao(os);
  const osId = os.id;
  return {
    ...escalares,
    itensServico: itensServico.map((i) => ({ osId, ...i })),
    itensPeca: itensPeca.map((i) => ({ osId, ...i })),
    historico: historico.map((h) => ({ osId, ...h })),
  };
};

describe('OrdemServicoMapper', () => {
  it('ida e volta de uma OS entregue preserva tudo, na ordem', () => {
    const os = osEntregue();
    const restaurada = OrdemServicoMapper.paraDominio(ida(os));

    expect(restaurada.equals(os)).toBe(true);
    expect(restaurada.status.valor).toBe('ENTREGUE');
    expect(restaurada.itensServico.map((i) => [i.servicoId, i.precoUnitario.centavos])).toEqual([['s1', 15000], ['s2', 9000]]);
    expect(restaurada.itensPeca.map((i) => [i.pecaId, i.quantidade.valor, i.precoUnitario.centavos])).toEqual([['p1', 2, 4000]]);
    expect(restaurada.historico.map((r) => r.status.valor)).toEqual([
      'RECEBIDA', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'EM_EXECUCAO', 'FINALIZADA', 'ENTREGUE',
    ]);
    expect(restaurada.orcamento?.decisao).toBe('APROVADO');
    expect(restaurada.orcamento?.total.centavos).toBe(32000);
    expect(restaurada.total.centavos).toBe(os.total.centavos);
    expect(restaurada.inicioExecucao).toEqual(em(6));
    expect(restaurada.fimExecucao).toEqual(em(30));
    expect(restaurada.puxarEventos()).toEqual([]);
  });

  it('a gravação deriva `abertaEm` do primeiro registro do histórico e numera as filhas', () => {
    const gravacao = OrdemServicoMapper.paraGravacao(osEntregue());

    expect(gravacao.escalares.abertaEm).toEqual(em(0));
    expect(gravacao.itensServico.map((i) => i.posicao)).toEqual([0, 1]);
    expect(gravacao.historico.map((h) => h.posicao)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('OS recém aberta grava as colunas do orçamento e da execução como nulas', () => {
    const os = OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' }, em(0));
    const { escalares } = OrdemServicoMapper.paraGravacao(os);

    expect(escalares).toMatchObject({
      status: 'RECEBIDA',
      inicioExecucao: null,
      fimExecucao: null,
      orcamentoTotalCentavos: null,
      orcamentoGeradoEm: null,
      orcamentoEnviado: null,
      orcamentoDecisao: null,
    });
    expect(OrdemServicoMapper.paraDominio(ida(os)).orcamento).toBeUndefined();
  });

  it('orçamento parcialmente preenchido é dado corrompido e falha na leitura', () => {
    const linha = { ...ida(OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' }, em(0))), orcamentoTotalCentavos: 1000 };

    expect(() => OrdemServicoMapper.paraDominio(linha)).toThrow('Orçamento parcialmente preenchido');
  });

  it('status e decisão desconhecidos na linha falham na leitura', () => {
    const base = ida(osEntregue());

    expect(() => OrdemServicoMapper.paraDominio({ ...base, status: 'XYZ' })).toThrow(DomainError);
    expect(() => OrdemServicoMapper.paraDominio({ ...base, orcamentoDecisao: 'TALVEZ' })).toThrow(DomainError);
  });

  it('OS sem histórico não pode ser gravada', () => {
    const vazia = OrdemServico.restaurar({
      id: 'o1', clienteId: 'c1', veiculoId: 'v1', status: 'RECEBIDA', itensServico: [], itensPeca: [], historico: [],
    });

    expect(() => OrdemServicoMapper.paraGravacao(vazia)).toThrow('sem histórico');
  });
});
