import { describe, expect, it } from 'bun:test';
import { DomainError } from '@domain/core/domain-error';
import { ItemPeca } from '@domain/ordem-servico/item-peca.vo';
import { ItemServico } from '@domain/ordem-servico/item-servico.vo';
import { Orcamento } from '@domain/ordem-servico/orcamento.vo';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { RegistroStatus } from '@domain/ordem-servico/registro-status.vo';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import { StatusOS } from '@domain/value-objects/status-os.vo';

const t = (min: number) => new Date(2026, 0, 1, 10, min);

const servico = { servicoId: 's1', precoUnitario: Dinheiro.deCentavos(10000) };
const peca = { pecaId: 'p1', quantidade: Quantidade.de(2), precoUnitario: Dinheiro.deCentavos(2500) };

const osRecebida = () => OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' }, t(0));

const osEmDiagnostico = () => {
  const os = osRecebida();
  os.iniciarDiagnostico(t(1));
  return os;
};

const osComItens = () => {
  const os = osEmDiagnostico();
  os.incluirServico(servico, t(2));
  os.incluirPeca(peca, t(2));
  return os;
};

const osAguardando = () => {
  const os = osComItens();
  os.gerarOrcamento(t(3));
  os.enviarOrcamento(t(4));
  return os;
};

const osEmExecucao = () => {
  const os = osAguardando();
  os.aprovarOrcamento(t(10));
  return os;
};

describe('OrdemServico: abertura', () => {
  it('abre Recebida, com histórico inicial e o evento OSAberta', () => {
    const os = osRecebida();
    expect(os.status.equals(StatusOS.RECEBIDA)).toBe(true);
    expect(os.clienteId).toBe('c1');
    expect(os.veiculoId).toBe('v1');
    expect(os.historico.map((r) => r.status.valor)).toEqual(['RECEBIDA']);
    expect(os.puxarEventos()).toEqual([{ nome: 'OSAberta', ocorridoEm: t(0), osId: os.id }]);
  });

  it('exige cliente e veículo', () => {
    expect(() => OrdemServico.abrir({ clienteId: '', veiculoId: 'v1' })).toThrow(DomainError);
    expect(() => OrdemServico.abrir({ clienteId: 'c1', veiculoId: '' })).toThrow(DomainError);
  });
});

describe('OrdemServico: itens', () => {
  it('o total é a soma de serviços e peças', () => {
    expect(osComItens().total.centavos).toBe(15000);
    expect(osRecebida().total.ehZero()).toBe(true);
  });

  it('aceita itens em Recebida e em Em diagnóstico', () => {
    const recebida = osRecebida();
    recebida.incluirServico(servico);
    expect(recebida.itensServico).toHaveLength(1);
    expect(osComItens().itensPeca).toHaveLength(1);
  });

  it('valida os itens', () => {
    const os = osEmDiagnostico();
    expect(() => os.incluirServico({ ...servico, servicoId: '' })).toThrow(DomainError);
    expect(() => os.incluirPeca({ ...peca, pecaId: '' })).toThrow(DomainError);
    expect(() => os.incluirPeca({ ...peca, quantidade: Quantidade.zero() })).toThrow(DomainError);
    expect(os.itensServico).toHaveLength(0);
    expect(os.itensPeca).toHaveLength(0);
  });

  it('não aceita itens depois de enviar o orçamento', () => {
    const os = osAguardando();
    expect(() => os.incluirServico(servico)).toThrow(DomainError);
    expect(() => os.incluirPeca(peca)).toThrow(DomainError);
    expect(osEmExecucao().status.permiteAlterarItens).toBe(false);
  });

  it('emite ServicoIncluido e PecaIncluida', () => {
    const os = osEmDiagnostico();
    os.puxarEventos();
    os.incluirServico(servico, t(2));
    os.incluirPeca(peca, t(3));
    expect(os.puxarEventos()).toEqual([
      { nome: 'ServicoIncluido', ocorridoEm: t(2), osId: os.id, servicoId: 's1' },
      { nome: 'PecaIncluida', ocorridoEm: t(3), osId: os.id, pecaId: 'p1' },
    ]);
  });

  it('o preço fica copiado no item no momento da inclusão', () => {
    const os = osComItens();
    expect(os.itensServico[0]!.precoUnitario.centavos).toBe(10000);
    expect(os.itensPeca[0]!.total.centavos).toBe(5000);
  });
});

describe('OrdemServico: orçamento', () => {
  it('gera o orçamento com o total dos itens', () => {
    const os = osComItens();
    os.gerarOrcamento(t(3));
    expect(os.orcamento?.total.centavos).toBe(15000);
    expect(os.orcamento?.decisao).toBe('PENDENTE');
    expect(os.orcamento?.enviado).toBe(false);
    expect(os.status.equals(StatusOS.EM_DIAGNOSTICO)).toBe(true);
  });

  it('só gera em diagnóstico e com ao menos um item', () => {
    expect(() => osEmDiagnostico().gerarOrcamento()).toThrow('ao menos um serviço ou peça');
    const recebida = osRecebida();
    recebida.incluirServico(servico);
    expect(() => recebida.gerarOrcamento()).toThrow('em diagnóstico');
    expect(() => osAguardando().gerarOrcamento()).toThrow('em diagnóstico');
  });

  it('gerar de novo substitui o orçamento anterior', () => {
    const os = osComItens();
    os.gerarOrcamento(t(3));
    os.gerarOrcamento(t(4));
    expect(os.orcamento?.geradoEm).toEqual(t(4));
  });

  it('incluir item descarta o orçamento que ainda não foi enviado', () => {
    const os = osComItens();
    os.gerarOrcamento(t(3));
    os.incluirServico({ servicoId: 's2', precoUnitario: Dinheiro.deCentavos(5000) });
    expect(os.orcamento).toBeUndefined();
    expect(() => os.enviarOrcamento()).toThrow('ainda não possui orçamento');
  });

  it('envia o orçamento e passa para Aguardando aprovação', () => {
    const os = osAguardando();
    expect(os.status.equals(StatusOS.AGUARDANDO_APROVACAO)).toBe(true);
    expect(os.orcamento?.enviado).toBe(true);
  });

  it('não envia sem orçamento, nem duas vezes, nem um orçamento já rejeitado', () => {
    expect(() => osComItens().enviarOrcamento()).toThrow('ainda não possui orçamento');
    expect(() => osAguardando().enviarOrcamento()).toThrow(DomainError);
    const os = osAguardando();
    os.rejeitarOrcamento(t(5));
    expect(() => os.enviarOrcamento()).toThrow('já foi enviado');
  });

  it('aprovar leva a Em execução e marca o início', () => {
    const os = osEmExecucao();
    expect(os.status.equals(StatusOS.EM_EXECUCAO)).toBe(true);
    expect(os.orcamento?.decisao).toBe('APROVADO');
    expect(os.inicioExecucao).toEqual(t(10));
  });

  it('rejeitar volta ao diagnóstico, libera a edição e permite um novo orçamento', () => {
    const os = osAguardando();
    os.rejeitarOrcamento(t(5));
    expect(os.status.equals(StatusOS.EM_DIAGNOSTICO)).toBe(true);
    expect(os.orcamento?.decisao).toBe('REJEITADO');

    os.incluirServico({ servicoId: 's2', precoUnitario: Dinheiro.deCentavos(1000) }, t(6));
    expect(os.orcamento).toBeUndefined();

    os.gerarOrcamento(t(7));
    os.enviarOrcamento(t(8));
    os.aprovarOrcamento(t(9));
    expect(os.status.equals(StatusOS.EM_EXECUCAO)).toBe(true);
    expect(os.orcamento?.total.centavos).toBe(16000);
  });

  it('aprovar e rejeitar exigem orçamento enviado e a OS aguardando', () => {
    expect(() => osComItens().aprovarOrcamento()).toThrow('ainda não possui orçamento');
    expect(() => osComItens().rejeitarOrcamento()).toThrow('ainda não possui orçamento');

    const gerado = osComItens();
    gerado.gerarOrcamento();
    expect(() => gerado.aprovarOrcamento()).toThrow('ainda não foi enviado');

    expect(() => osEmExecucao().aprovarOrcamento()).toThrow(DomainError);
    expect(() => osEmExecucao().rejeitarOrcamento()).toThrow(DomainError);
  });

  it('uma operação inválida não altera o estado nem emite evento', () => {
    const os = osEmExecucao();
    os.puxarEventos();
    expect(() => os.rejeitarOrcamento()).toThrow(DomainError);
    expect(os.status.equals(StatusOS.EM_EXECUCAO)).toBe(true);
    expect(os.orcamento?.decisao).toBe('APROVADO');
    expect(os.historico).toHaveLength(4);
    expect(os.puxarEventos()).toEqual([]);
  });
});

describe('OrdemServico: execução e entrega', () => {
  it('finaliza e entrega, calculando a duração da execução', () => {
    const os = osEmExecucao();
    expect(os.duracaoExecucaoMs).toBeUndefined();
    os.finalizar(t(40));
    expect(os.status.equals(StatusOS.FINALIZADA)).toBe(true);
    expect(os.fimExecucao).toEqual(t(40));
    expect(os.duracaoExecucaoMs).toBe(30 * 60 * 1000);
    os.entregar(t(50));
    expect(os.status.equals(StatusOS.ENTREGUE)).toBe(true);
  });

  it('guarda o histórico completo de status', () => {
    const os = osEmExecucao();
    os.finalizar(t(40));
    os.entregar(t(50));
    expect(os.historico.map((r) => r.status.valor)).toEqual([
      'RECEBIDA',
      'EM_DIAGNOSTICO',
      'AGUARDANDO_APROVACAO',
      'EM_EXECUCAO',
      'FINALIZADA',
      'ENTREGUE',
    ]);
  });

  it('emite todos os eventos do fluxo, na ordem do Event Storming', () => {
    const os = osEmExecucao();
    os.finalizar(t(40));
    os.entregar(t(50));
    expect(os.puxarEventos().map((e) => e.nome)).toEqual([
      'OSAberta',
      'DiagnosticoIniciado',
      'ServicoIncluido',
      'PecaIncluida',
      'OrcamentoGerado',
      'OrcamentoEnviado',
      'OrcamentoAprovado',
      'ExecucaoIniciada',
      'OSFinalizada',
      'VeiculoEntregue',
    ]);
    expect(os.puxarEventos()).toEqual([]);
  });

  it('o evento OrcamentoGerado carrega o total e OrcamentoRejeitado existe', () => {
    const os = osAguardando();
    os.rejeitarOrcamento(t(5));
    const eventos = os.puxarEventos();
    expect(eventos.find((e) => e.nome === 'OrcamentoGerado')).toMatchObject({ total: 15000 });
    expect(eventos[eventos.length - 1]?.nome).toBe('OrcamentoRejeitado');
  });
});

describe('OrdemServico: regras de transição', () => {
  it('rejeita ações fora de ordem', () => {
    expect(() => osRecebida().finalizar()).toThrow('Transição inválida');
    expect(() => osRecebida().entregar()).toThrow(DomainError);
    expect(() => osEmDiagnostico().iniciarDiagnostico()).toThrow(DomainError);
    expect(() => osAguardando().finalizar()).toThrow(DomainError);
    expect(() => osEmExecucao().entregar()).toThrow(DomainError);
  });

  it('uma OS entregue não aceita mais nada', () => {
    const os = osEmExecucao();
    os.finalizar(t(40));
    os.entregar(t(50));
    expect(() => os.entregar()).toThrow(DomainError);
    expect(() => os.finalizar()).toThrow(DomainError);
    expect(() => os.incluirServico(servico)).toThrow(DomainError);
  });
});

describe('OrdemServico: restaurar', () => {
  it('reconstrói o estado sem emitir eventos e compara por identidade', () => {
    const os = osEmExecucao();
    const copia = OrdemServico.restaurar({
      id: os.id,
      clienteId: os.clienteId,
      veiculoId: os.veiculoId,
      status: 'EM_EXECUCAO',
      itensServico: [...os.itensServico],
      itensPeca: [...os.itensPeca],
      historico: [...os.historico],
      orcamento: Orcamento.restaurar({
        total: Dinheiro.deCentavos(15000),
        geradoEm: t(3),
        enviado: true,
        decisao: 'APROVADO',
      }),
      inicioExecucao: t(10),
    });
    expect(copia.total.centavos).toBe(15000);
    expect(copia.status.equals(StatusOS.EM_EXECUCAO)).toBe(true);
    expect(copia.inicioExecucao).toEqual(t(10));
    expect(copia.puxarEventos()).toEqual([]);
    expect(copia.equals(os)).toBe(true);
    copia.finalizar(t(40));
    expect(copia.duracaoExecucaoMs).toBe(30 * 60 * 1000);
  });

  it('rejeita status desconhecido vindo da persistência', () => {
    expect(() =>
      OrdemServico.restaurar({
        id: 'os1',
        clienteId: 'c1',
        veiculoId: 'v1',
        status: 'EM_LIMBO',
        itensServico: [ItemServico.criar(servico)],
        itensPeca: [ItemPeca.criar(peca)],
        historico: [RegistroStatus.de(StatusOS.RECEBIDA, t(0))],
      }),
    ).toThrow(DomainError);
  });
});
