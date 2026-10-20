import { describe, expect, it } from 'bun:test';
import { DomainError } from '@domain/core/domain-error';
import {
  type LinhaDetalhe,
  paraDetalheDto,
  paraResumoDto,
} from '@infrastructure/persistence/ordem-servico/ordem-servico-dto.mapper';

const em = (minutos: number) => new Date(Date.UTC(2026, 0, 10, 10, minutos));

const linhaEntregue = (): LinhaDetalhe => ({
  id: 'o1',
  clienteId: 'c1',
  veiculoId: 'v1',
  status: 'ENTREGUE',
  abertaEm: em(0),
  itensServico: [
    { servicoId: 's1', precoUnitarioCentavos: 15000 },
    { servicoId: 's2', precoUnitarioCentavos: 9000 },
  ],
  itensPeca: [{ pecaId: 'p1', quantidade: 2, precoUnitarioCentavos: 4000 }],
  historico: [
    { status: 'RECEBIDA', alteradoEm: em(0) },
    { status: 'ENTREGUE', alteradoEm: em(40) },
  ],
  inicioExecucao: em(6),
  fimExecucao: em(30),
  orcamentoTotalCentavos: 32000,
  orcamentoGeradoEm: em(4),
  orcamentoEnviado: true,
  orcamentoDecisao: 'APROVADO',
});

describe('paraResumoDto', () => {
  it('recalcula o total: serviços mais quantidade vezes preço das peças', () => {
    expect(paraResumoDto(linhaEntregue())).toEqual({
      id: 'o1',
      clienteId: 'c1',
      veiculoId: 'v1',
      status: 'ENTREGUE',
      totalCentavos: 32000,
      abertaEm: em(0),
    });
  });

  it('OS sem itens tem total zero', () => {
    const linha = { ...linhaEntregue(), itensServico: [], itensPeca: [] };

    expect(paraResumoDto(linha).totalCentavos).toBe(0);
  });

  it('status desconhecido na linha falha na leitura', () => {
    expect(() => paraResumoDto({ ...linhaEntregue(), status: 'XYZ' })).toThrow(DomainError);
  });
});

describe('paraDetalheDto', () => {
  it('traz itens, orçamento, histórico e execução', () => {
    expect(paraDetalheDto(linhaEntregue())).toEqual({
      id: 'o1',
      clienteId: 'c1',
      veiculoId: 'v1',
      status: 'ENTREGUE',
      totalCentavos: 32000,
      abertaEm: em(0),
      itensServico: [
        { servicoId: 's1', precoUnitarioCentavos: 15000 },
        { servicoId: 's2', precoUnitarioCentavos: 9000 },
      ],
      itensPeca: [{ pecaId: 'p1', quantidade: 2, precoUnitarioCentavos: 4000 }],
      orcamento: { totalCentavos: 32000, enviado: true, decisao: 'APROVADO' },
      historico: [
        { status: 'RECEBIDA', alteradoEm: em(0) },
        { status: 'ENTREGUE', alteradoEm: em(40) },
      ],
      inicioExecucao: em(6),
      fimExecucao: em(30),
    });
  });

  it('sem orçamento, o campo é null', () => {
    const linha: LinhaDetalhe = {
      ...linhaEntregue(),
      orcamentoTotalCentavos: null,
      orcamentoGeradoEm: null,
      orcamentoEnviado: null,
      orcamentoDecisao: null,
    };

    expect(paraDetalheDto(linha).orcamento).toBeNull();
  });

  it('orçamento parcialmente preenchido é dado corrompido e falha na leitura', () => {
    expect(() => paraDetalheDto({ ...linhaEntregue(), orcamentoEnviado: null })).toThrow('parcialmente preenchido');
  });

  it('status desconhecido no histórico falha na leitura', () => {
    const linha = { ...linhaEntregue(), historico: [{ status: 'XYZ', alteradoEm: em(0) }] };

    expect(() => paraDetalheDto(linha)).toThrow(DomainError);
  });
});
