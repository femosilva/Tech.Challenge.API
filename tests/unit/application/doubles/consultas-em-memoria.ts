import type { ClienteConsultas, ClienteDto } from '@application/cadastro/cliente/cliente-consultas.port';
import type { VeiculoConsultas, VeiculoDto } from '@application/cadastro/veiculo/veiculo-consultas.port';
import type { OrdemServicoConsultas } from '@application/ordem-servico/ordem-servico-consultas.port';
import type { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import type { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import type { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import type {
  ClienteRepositorioEmMemoria,
  OrdemServicoRepositorioEmMemoria,
  VeiculoRepositorioEmMemoria,
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

export class OrdemServicoConsultasEmMemoria implements OrdemServicoConsultas {
  constructor(private readonly ordens: OrdemServicoRepositorioEmMemoria) {}

  async existePorCliente(filtro: Pick<OrdemServico, 'clienteId'>): Promise<boolean> {
    return this.ordens.todos().some((o) => o.clienteId === filtro.clienteId);
  }
  async existePorVeiculo(filtro: Pick<OrdemServico, 'veiculoId'>): Promise<boolean> {
    return this.ordens.todos().some((o) => o.veiculoId === filtro.veiculoId);
  }
}
