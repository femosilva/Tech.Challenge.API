import type { ClienteConsultas, ClienteDto } from '@application/cadastro/cliente-consultas.port';
import type { VeiculoConsultas } from '@application/cadastro/veiculo-consultas.port';
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

export class VeiculoConsultasEmMemoria implements VeiculoConsultas {
  constructor(private readonly veiculos: VeiculoRepositorioEmMemoria) {}

  async existePorCliente(filtro: Pick<Veiculo, 'clienteId'>): Promise<boolean> {
    return this.veiculos.todos().some((v) => v.clienteId === filtro.clienteId);
  }
}

export class OrdemServicoConsultasEmMemoria implements OrdemServicoConsultas {
  constructor(private readonly ordens: OrdemServicoRepositorioEmMemoria) {}

  async existePorCliente(filtro: Pick<OrdemServico, 'clienteId'>): Promise<boolean> {
    return this.ordens.todos().some((o) => o.clienteId === filtro.clienteId);
  }
}
