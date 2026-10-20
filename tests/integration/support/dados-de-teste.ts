import { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import { ClienteRepositoryAdapter } from '@infrastructure/persistence/cadastro/cliente/cliente-repository.adapter';
import { prisma } from './banco-de-teste';

export const CPF_ANA = '529.982.247-25';
export const CPF_BIA = '111.444.777-35';

export async function salvarCliente(nome = 'Ana', documento = CPF_ANA): Promise<Cliente> {
  const cliente = Cliente.cadastrar({ nome, documento });
  await new ClienteRepositoryAdapter(prisma).salvar(cliente);
  return cliente;
}

/** OS mínima direto no banco, só para criar vínculos que a FK Restrict deve proteger. */
export function inserirOrdem(dados: { clienteId: string; veiculoId: string; servicoId?: string; pecaId?: string }) {
  const { clienteId, veiculoId, servicoId, pecaId } = dados;
  return prisma.ordemServico.create({
    data: {
      id: crypto.randomUUID(),
      clienteId,
      veiculoId,
      status: 'RECEBIDA',
      abertaEm: new Date(),
      ...(servicoId && { itensServico: { create: [{ posicao: 0, servicoId, precoUnitarioCentavos: 100 }] } }),
      ...(pecaId && { itensPeca: { create: [{ posicao: 0, pecaId, quantidade: 1, precoUnitarioCentavos: 100 }] } }),
    },
  });
}
