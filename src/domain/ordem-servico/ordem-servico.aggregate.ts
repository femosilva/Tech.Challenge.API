import type { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import type { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import { AggregateRoot } from '@domain/core/aggregate-root';
import { DomainError } from '@domain/core/domain-error';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { StatusOS } from '@domain/value-objects/status-os.vo';
import { ItemPeca } from './item-peca.vo';
import { ItemServico } from './item-servico.vo';
import { Orcamento } from './orcamento.vo';
import type { OrdemServicoEvent } from './ordem-servico.events';
import { RegistroStatus } from './registro-status.vo';

/** O que muda ao longo da vida da OS. O que nunca muda fica como readonly na classe. */
type Estado = {
  status: StatusOS;
  itensServico: ItemServico[];
  itensPeca: ItemPeca[];
  orcamento?: Orcamento;
  historico: RegistroStatus[];
  inicioExecucao?: Date;
  fimExecucao?: Date;
};

type Restaurar = Pick<
  OrdemServico,
  'id' | 'clienteId' | 'veiculoId' | 'itensServico' | 'itensPeca' | 'historico'
> &
  Partial<Pick<OrdemServico, 'orcamento' | 'inicioExecucao' | 'fimExecucao'>> & { status: string };

export class OrdemServico extends AggregateRoot<OrdemServicoEvent> {
  private constructor(
    id: string,
    readonly clienteId: Cliente['id'],
    readonly veiculoId: Veiculo['id'],
    private estado: Estado,
  ) {
    super(id);
  }

  static abrir(
    dados: Pick<OrdemServico, 'clienteId' | 'veiculoId'>,
    agora = new Date(),
  ): OrdemServico {
    if (!dados.clienteId) throw new DomainError('Cliente é obrigatório');
    if (!dados.veiculoId) throw new DomainError('Veículo é obrigatório');
    const os = new OrdemServico(OrdemServico.gerarId(), dados.clienteId, dados.veiculoId, {
      status: StatusOS.RECEBIDA,
      itensServico: [],
      itensPeca: [],
      historico: [RegistroStatus.de(StatusOS.RECEBIDA, agora)],
    });
    os.registrar({ nome: 'OSAberta', ocorridoEm: agora, osId: os.id });
    return os;
  }

  /** Reconstrói a partir da persistência; não gera evento. */
  static restaurar(dados: Restaurar): OrdemServico {
    return new OrdemServico(dados.id, dados.clienteId, dados.veiculoId, {
      status: StatusOS.de(dados.status),
      itensServico: [...dados.itensServico],
      itensPeca: [...dados.itensPeca],
      orcamento: dados.orcamento,
      historico: [...dados.historico],
      inicioExecucao: dados.inicioExecucao,
      fimExecucao: dados.fimExecucao,
    });
  }

  get status(): StatusOS {
    return this.estado.status;
  }

  get itensServico(): readonly ItemServico[] {
    return this.estado.itensServico;
  }

  get itensPeca(): readonly ItemPeca[] {
    return this.estado.itensPeca;
  }

  get orcamento(): Orcamento | undefined {
    return this.estado.orcamento;
  }

  get historico(): readonly RegistroStatus[] {
    return this.estado.historico;
  }

  get inicioExecucao(): Date | undefined {
    return this.estado.inicioExecucao;
  }

  get fimExecucao(): Date | undefined {
    return this.estado.fimExecucao;
  }

  /** Invariante: o total é sempre a soma dos itens. */
  get total(): Dinheiro {
    const servicos = this.estado.itensServico.reduce((soma, i) => soma.somar(i.total), Dinheiro.zero());
    return this.estado.itensPeca.reduce((soma, i) => soma.somar(i.total), servicos);
  }

  /** Duração da execução em milissegundos; só existe depois de finalizada. */
  get duracaoExecucaoMs(): number | undefined {
    const { inicioExecucao, fimExecucao } = this.estado;
    return inicioExecucao && fimExecucao ? fimExecucao.getTime() - inicioExecucao.getTime() : undefined;
  }

  iniciarDiagnostico(agora = new Date()): void {
    this.transitar(StatusOS.EM_DIAGNOSTICO, agora);
    this.registrar({ nome: 'DiagnosticoIniciado', ocorridoEm: agora, osId: this.id });
  }

  incluirServico(
    dados: Pick<ItemServico, 'servicoId' | 'precoUnitario'>,
    agora = new Date(),
  ): void {
    this.exigirItensEditaveis();
    this.estado.itensServico.push(ItemServico.criar(dados));
    this.estado.orcamento = undefined;
    this.registrar({ nome: 'ServicoIncluido', ocorridoEm: agora, osId: this.id, servicoId: dados.servicoId });
  }

  incluirPeca(
    dados: Pick<ItemPeca, 'pecaId' | 'quantidade' | 'precoUnitario'>,
    agora = new Date(),
  ): void {
    this.exigirItensEditaveis();
    this.estado.itensPeca.push(ItemPeca.criar(dados));
    this.estado.orcamento = undefined;
    this.registrar({ nome: 'PecaIncluida', ocorridoEm: agora, osId: this.id, pecaId: dados.pecaId });
  }

  /** Calcula o orçamento a partir dos itens atuais; substitui o anterior, se houver. */
  gerarOrcamento(agora = new Date()): void {
    if (!this.status.equals(StatusOS.EM_DIAGNOSTICO)) {
      throw new DomainError('Orçamento só pode ser gerado com a OS em diagnóstico');
    }
    if (this.estado.itensServico.length === 0 && this.estado.itensPeca.length === 0) {
      throw new DomainError('Inclua ao menos um serviço ou peça antes de gerar o orçamento');
    }
    const orcamento = Orcamento.gerar(this.total, agora);
    this.estado.orcamento = orcamento;
    this.registrar({
      nome: 'OrcamentoGerado',
      ocorridoEm: agora,
      osId: this.id,
      total: orcamento.total.centavos,
    });
  }

  enviarOrcamento(agora = new Date()): void {
    const enviado = this.exigirOrcamento().enviar();
    this.transitar(StatusOS.AGUARDANDO_APROVACAO, agora);
    this.estado.orcamento = enviado;
    this.registrar({ nome: 'OrcamentoEnviado', ocorridoEm: agora, osId: this.id });
  }

  aprovarOrcamento(agora = new Date()): void {
    const aprovado = this.exigirOrcamento().aprovar();
    this.transitar(StatusOS.EM_EXECUCAO, agora);
    this.estado.orcamento = aprovado;
    this.estado.inicioExecucao = agora;
    this.registrar({ nome: 'OrcamentoAprovado', ocorridoEm: agora, osId: this.id });
    this.registrar({ nome: 'ExecucaoIniciada', ocorridoEm: agora, osId: this.id });
  }

  /** Rejeitar devolve a OS ao diagnóstico, onde os itens podem ser ajustados. */
  rejeitarOrcamento(agora = new Date()): void {
    const rejeitado = this.exigirOrcamento().rejeitar();
    this.transitar(StatusOS.EM_DIAGNOSTICO, agora);
    this.estado.orcamento = rejeitado;
    this.registrar({ nome: 'OrcamentoRejeitado', ocorridoEm: agora, osId: this.id });
  }

  finalizar(agora = new Date()): void {
    this.transitar(StatusOS.FINALIZADA, agora);
    this.estado.fimExecucao = agora;
    this.registrar({ nome: 'OSFinalizada', ocorridoEm: agora, osId: this.id });
  }

  entregar(agora = new Date()): void {
    this.transitar(StatusOS.ENTREGUE, agora);
    this.registrar({ nome: 'VeiculoEntregue', ocorridoEm: agora, osId: this.id });
  }

  /** Único ponto que altera o status: aplica a regra de transição e guarda o histórico. */
  private transitar(para: StatusOS, agora: Date): void {
    if (!this.status.podeIrPara(para)) {
      throw new DomainError(`Transição inválida: ${this.status.valor} -> ${para.valor}`);
    }
    this.estado.status = para;
    this.estado.historico.push(RegistroStatus.de(para, agora));
  }

  private exigirItensEditaveis(): void {
    if (!this.status.permiteAlterarItens) {
      throw new DomainError('Serviços e peças só podem ser alterados em Recebida ou Em diagnóstico');
    }
  }

  private exigirOrcamento(): Orcamento {
    if (!this.estado.orcamento) throw new DomainError('A OS ainda não possui orçamento');
    return this.estado.orcamento;
  }
}
