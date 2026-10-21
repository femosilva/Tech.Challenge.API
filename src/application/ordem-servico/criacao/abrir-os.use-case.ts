import { ReferenciaInvalidaError } from '@application/core/erros';
import type { PublicadorEventos } from '@application/core/publicador-eventos.port';
import type { ClienteRepository } from '@domain/cadastro/cliente/cliente.repository';
import type { VeiculoRepository } from '@domain/cadastro/veiculo/veiculo.repository';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import type { OrdemServicoRepository } from '@domain/ordem-servico/ordem-servico.repository';
import { CpfCnpj } from '@domain/value-objects/cpf-cnpj.vo';
import { Placa } from '@domain/value-objects/placa.vo';

export class AbrirOS {
  constructor(
    private readonly clientes: ClienteRepository,
    private readonly veiculos: VeiculoRepository,
    private readonly ordens: OrdemServicoRepository,
    private readonly eventos: PublicadorEventos,
  ) {}

  async executar(input: AbrirOS.Input): Promise<AbrirOS.Output> {
    const documento = CpfCnpj.criar(input.documento);
    const placa = Placa.criar(input.placa);

    const cliente = await this.clientes.buscarPorDocumento({ documento });
    if (!cliente) throw new ReferenciaInvalidaError('Cliente não encontrado para o documento informado');

    const veiculo = await this.veiculos.buscarPorPlaca({ placa });
    if (!veiculo) throw new ReferenciaInvalidaError('Veículo não encontrado para a placa informada');
    if (veiculo.clienteId !== cliente.id) throw new ReferenciaInvalidaError('Veículo não pertence ao cliente');

    const os = OrdemServico.abrir({ clienteId: cliente.id, veiculoId: veiculo.id });
    await this.ordens.salvar(os);
    await this.eventos.publicar(os.puxarEventos());
    return { id: os.id };
  }
}

export namespace AbrirOS {
  export type Input = { documento: string; placa: string };
  export type Output = Pick<OrdemServico, 'id'>;
}
