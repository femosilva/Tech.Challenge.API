import { NaoEncontradoError } from '@application/core/erros';
import type { ClienteRepository } from '@domain/cadastro/cliente/cliente.repository';
import type { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import type { OrdemServicoRepository } from '@domain/ordem-servico/ordem-servico.repository';
import { CpfCnpj } from '@domain/value-objects/cpf-cnpj.vo';

type Repositorios = { ordens: OrdemServicoRepository; clientes: ClienteRepository };
type Identificacao = Pick<OrdemServico, 'id'> & { documento: string };

/**
 * Identifica o cliente nos endpoints dele (sem JWT): número da OS mais CPF/CNPJ.
 * OS inexistente e documento que não confere dão o mesmo erro, para não revelar que a OS existe.
 */
export async function buscarOSDoCliente(repos: Repositorios, { id, documento }: Identificacao): Promise<OrdemServico> {
  const informado = CpfCnpj.criar(documento);
  const os = await repos.ordens.buscarPorId({ id });
  const cliente = os && (await repos.clientes.buscarPorId({ id: os.clienteId }));

  if (!os || !cliente || !cliente.documento.equals(informado)) throw new NaoEncontradoError('Ordem de serviço');
  return os;
}
