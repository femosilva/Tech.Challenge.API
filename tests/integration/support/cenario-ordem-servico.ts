import { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import { Servico } from '@domain/catalogo/servico.aggregate';
import { Peca } from '@domain/estoque/peca.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import { VeiculoRepositoryAdapter } from '@infrastructure/persistence/cadastro/veiculo/veiculo-repository.adapter';
import { ServicoRepositoryAdapter } from '@infrastructure/persistence/catalogo/servico-repository.adapter';
import { PecaRepositoryAdapter } from '@infrastructure/persistence/estoque/peca-repository.adapter';
import { prisma } from './banco-de-teste';
import { salvarCliente } from './dados-de-teste';

/** Cliente, veículo, serviço e peça já gravados: o que uma OS precisa para existir. */
export async function prepararCenario() {
  const cliente = await salvarCliente();
  const veiculo = Veiculo.registrar({ clienteId: cliente.id, placa: 'ABC1D23', marca: 'VW', modelo: 'Gol', ano: 2020 });
  await new VeiculoRepositoryAdapter(prisma).salvar(veiculo);
  const servico = Servico.cadastrar({ nome: 'Troca de óleo', preco: Dinheiro.deCentavos(15000) });
  await new ServicoRepositoryAdapter(prisma).salvar(servico);
  const peca = Peca.cadastrar({ codigo: 'FIL-01', nome: 'Filtro', preco: Dinheiro.deCentavos(4000), saldo: Quantidade.de(10) });
  await new PecaRepositoryAdapter(prisma).salvar(peca);
  return { cliente, veiculo, servico, peca };
}
