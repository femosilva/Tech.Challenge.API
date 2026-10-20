import type { PublicadorEventos } from '@application/core/publicador-eventos.port';
import { Peca } from '@domain/estoque/peca.aggregate';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import { PecaRepositoryAdapter } from '@infrastructure/persistence/estoque/peca-repository.adapter';
import { OrdemServicoRepositoryAdapter } from '@infrastructure/persistence/ordem-servico/ordem-servico-repository.adapter';
import { prisma } from './banco-de-teste';
import type { prepararCenario } from './cenario-ordem-servico';

export type Cenario = Awaited<ReturnType<typeof prepararCenario>>;

export const semEventos: PublicadorEventos = { publicar: async () => {} };

export async function salvarPeca(codigo: string, saldo: number): Promise<Peca> {
  const peca = Peca.cadastrar({ codigo, nome: `Peça ${codigo}`, preco: Dinheiro.deCentavos(4000), saldo: Quantidade.de(saldo) });
  await new PecaRepositoryAdapter(prisma).salvar(peca);
  return peca;
}

/** OS com o orçamento já enviado, esperando o cliente aprovar; os itens de peça seguem a ordem dada. */
export async function salvarOsAguardandoAprovacao(
  { cliente, veiculo, servico }: Cenario,
  pecas: { peca: Peca; quantidade: number }[],
): Promise<OrdemServico> {
  const os = OrdemServico.abrir({ clienteId: cliente.id, veiculoId: veiculo.id });
  os.iniciarDiagnostico();
  os.incluirServico({ servicoId: servico.id, precoUnitario: Dinheiro.deCentavos(15000) });
  for (const { peca, quantidade } of pecas) {
    os.incluirPeca({ pecaId: peca.id, quantidade: Quantidade.de(quantidade), precoUnitario: peca.preco });
  }
  os.gerarOrcamento();
  os.enviarOrcamento();
  await new OrdemServicoRepositoryAdapter(prisma).salvar(os);
  return os;
}
