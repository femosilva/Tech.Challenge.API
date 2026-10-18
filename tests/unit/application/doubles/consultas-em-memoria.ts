import type { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import type { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import type { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import type { Servico } from '@domain/catalogo/servico.aggregate';
import type { Peca } from '@domain/estoque/peca.aggregate';

import type { ClienteConsultas, ClienteDto } from '@application/cadastro/cliente/cliente-consultas.port';
import type { VeiculoConsultas, VeiculoDto } from '@application/cadastro/veiculo/veiculo-consultas.port';
import type {
  OrdemServicoConsultas,
  OrdemServicoDetalheDto,
  OrdemServicoResumoDto,
  Pagina,
  Paginacao,
  TempoMedioExecucaoDto,
} from '@application/ordem-servico/ordem-servico-consultas.port';
import type { ServicoConsultas, ServicoDto } from '@application/catalogo/servico-consultas.port';
import type { PecaConsultas, PecaDto } from '@application/estoque/peca-consultas.port';
import type {
  ClienteRepositorioEmMemoria,
  OrdemServicoRepositorioEmMemoria,
  VeiculoRepositorioEmMemoria,
  ServicoRepositorioEmMemoria,
  PecaRepositorioEmMemoria
} from './repositorios-em-memoria.test';

const paraDto = (c: Cliente): ClienteDto => ({ id: c.id, nome: c.nome, documento: c.documento.numero });

/** As consultas leem o que os repositórios em memória guardaram. */
export class ClienteConsultasEmMemoria implements ClienteConsultas {
  constructor(private readonly clientes: ClienteRepositorioEmMemoria) {}

  async listar(): Promise<ClienteDto[]> {
    return this.clientes.todos().map(paraDto);
  }

  async obter(filtro: Pick<Cliente, 'id'>): Promise<ClienteDto | null> {
    const cliente = await this.clientes.buscarPorId(filtro);
    return cliente ? paraDto(cliente) : null;
  }
}


const paraVeiculoDto = (v: Veiculo): VeiculoDto => ({
  id: v.id,
  clienteId: v.clienteId,
  placa: v.placa.valor,
  marca: v.marca,
  modelo: v.modelo,
  ano: v.ano,
});
export class VeiculoConsultasEmMemoria implements VeiculoConsultas {
  constructor(private readonly veiculos: VeiculoRepositorioEmMemoria) {}

  async listar(): Promise<VeiculoDto[]> {
    return this.veiculos.todos().map(paraVeiculoDto);
  }

  async obter(filtro: Pick<Veiculo, 'id'>): Promise<VeiculoDto | null> {
    const veiculo = await this.veiculos.buscarPorId(filtro);
    return veiculo ? paraVeiculoDto(veiculo) : null;
  }

  async listarPorCliente(filtro: Pick<Veiculo, 'clienteId'>): Promise<VeiculoDto[]> {
    return this.veiculos
      .todos()
      .filter((v) => v.clienteId === filtro.clienteId)
      .map(paraVeiculoDto);
  }

  async existePorCliente(filtro: Pick<Veiculo, 'clienteId'>): Promise<boolean> {
    return this.veiculos.todos().some((v) => v.clienteId === filtro.clienteId);
  }
}

const paraServicoDto = (s: Servico): ServicoDto => ({ id: s.id, nome: s.nome, precoCentavos: s.preco.centavos });

export class ServicoConsultasEmMemoria implements ServicoConsultas {
  constructor(private readonly servicos: ServicoRepositorioEmMemoria) {}

  async listar(): Promise<ServicoDto[]> {
    return this.servicos.todos().map(paraServicoDto);
  }

  async obter(filtro: Pick<Servico, 'id'>): Promise<ServicoDto | null> {
    const servico = await this.servicos.buscarPorId(filtro);
    return servico ? paraServicoDto(servico) : null;
  }
}
const paraPecaDto = (p: Peca): PecaDto => ({
  id: p.id,
  codigo: p.codigo,
  nome: p.nome,
  precoCentavos: p.preco.centavos,
  saldo: p.saldo.valor,
});

export class PecaConsultasEmMemoria implements PecaConsultas {
  constructor(private readonly pecas: PecaRepositorioEmMemoria) {}

  async listar(): Promise<PecaDto[]> {
    return this.pecas.todos().map(paraPecaDto);
  }

  async obter(filtro: Pick<Peca, 'id'>): Promise<PecaDto | null> {
    const peca = await this.pecas.buscarPorId(filtro);
    return peca ? paraPecaDto(peca) : null;
  }
}
export class OrdemServicoConsultasEmMemoria implements OrdemServicoConsultas {
  constructor(private readonly ordens: OrdemServicoRepositorioEmMemoria) {}

  async existePorCliente(filtro: Pick<OrdemServico, 'clienteId'>): Promise<boolean> {
    return this.ordens.todos().some((o) => o.clienteId === filtro.clienteId);
  }
  async existePorVeiculo(filtro: Pick<OrdemServico, 'veiculoId'>): Promise<boolean> {
    return this.ordens.todos().some((o) => o.veiculoId === filtro.veiculoId);
  }
  async existePorServico(filtro: Pick<Servico, 'id'>): Promise<boolean> {
    return this.ordens.todos().some((o) => o.itensServico.some((i) => i.servicoId === filtro.id));
  }
  async existePorPeca(filtro: Pick<Peca, 'id'>): Promise<boolean> {
    return this.ordens.todos().some((o) => o.itensPeca.some((i) => i.pecaId === filtro.id));
  }
  async listar({ pagina, tamanho }: Paginacao): Promise<Pagina<OrdemServicoResumoDto>> {
    const todas = this.ordens
      .todos()
      .map(paraResumoDto)
      .sort((a, b) => b.abertaEm.getTime() - a.abertaEm.getTime());
    const inicio = (pagina - 1) * tamanho;
    return { pagina, tamanho, total: todas.length, itens: todas.slice(inicio, inicio + tamanho) };
  }

  async detalhar(filtro: Pick<OrdemServico, 'id'>): Promise<OrdemServicoDetalheDto | null> {
    const os = await this.ordens.buscarPorId(filtro);
    return os ? paraDetalheDto(os) : null;
  }

  async tempoMedioExecucao(): Promise<TempoMedioExecucaoDto> {
    const duracoes = this.ordens
      .todos()
      .map((o) => o.duracaoExecucaoMs)
      .filter((d): d is number => d !== undefined);
    const soma = duracoes.reduce((total, d) => total + d, 0);
    return { ordensConsideradas: duracoes.length, mediaMs: duracoes.length ? soma / duracoes.length : null };
  }
}
const paraResumoDto = (o: OrdemServico): OrdemServicoResumoDto => ({
  id: o.id,
  clienteId: o.clienteId,
  veiculoId: o.veiculoId,
  status: o.status.valor,
  totalCentavos: o.total.centavos,
  abertaEm: o.historico[0]!.alteradoEm,
});

const paraDetalheDto = (o: OrdemServico): OrdemServicoDetalheDto => ({
  ...paraResumoDto(o),
  itensServico: o.itensServico.map((i) => ({ servicoId: i.servicoId, precoUnitarioCentavos: i.precoUnitario.centavos })),
  itensPeca: o.itensPeca.map((i) => ({
    pecaId: i.pecaId,
    quantidade: i.quantidade.valor,
    precoUnitarioCentavos: i.precoUnitario.centavos,
  })),
  orcamento: o.orcamento
    ? { totalCentavos: o.orcamento.total.centavos, enviado: o.orcamento.enviado, decisao: o.orcamento.decisao }
    : null,
  historico: o.historico.map((r) => ({ status: r.status.valor, alteradoEm: r.alteradoEm })),
  inicioExecucao: o.inicioExecucao ?? null,
  fimExecucao: o.fimExecucao ?? null,
});
