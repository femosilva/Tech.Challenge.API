import type { ClienteConsultas } from '@application/cadastro/cliente/cliente-consultas.port';
import { NaoEncontradoError } from '@application/core/erros';
import type { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { CpfCnpj } from '@domain/value-objects/cpf-cnpj.vo';
import type { OrdemServicoConsultas, OrdemServicoDetalheDto } from './ordem-servico-consultas.port';

/** Consulta do cliente (sem JWT): número da OS mais CPF/CNPJ, como em aprovar e rejeitar. */
export class ConsultarAndamento {
  constructor(
    private readonly ordens: OrdemServicoConsultas,
    private readonly clientes: ClienteConsultas,
  ) {}

  async executar(input: ConsultarAndamento.Input): Promise<ConsultarAndamento.Output> {
    const informado = CpfCnpj.criar(input.documento);
    const detalhe = await this.ordens.detalhar({ id: input.id });
    const cliente = detalhe && (await this.clientes.obter({ id: detalhe.clienteId }));

    // Mesmo erro para OS inexistente e documento que não confere: não revela que a OS existe.
    if (!detalhe || !cliente || cliente.documento !== informado.numero) {
      throw new NaoEncontradoError('Ordem de serviço');
    }
    return detalhe;
  }
}

export namespace ConsultarAndamento {
  export type Input = Pick<OrdemServico, 'id'> & { documento: string };
  export type Output = OrdemServicoDetalheDto;
}
