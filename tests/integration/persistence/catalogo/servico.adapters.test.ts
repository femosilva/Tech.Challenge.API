import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { ConflitoError } from '@application/core/erros';
import { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import { Servico } from '@domain/catalogo/servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { VeiculoRepositoryAdapter } from '@infrastructure/persistence/cadastro/veiculo/veiculo-repository.adapter';
import { ServicoConsultasAdapter } from '@infrastructure/persistence/catalogo/servico-consultas.adapter';
import { ServicoRepositoryAdapter } from '@infrastructure/persistence/catalogo/servico-repository.adapter';
import { limparBanco, prisma } from '../../support/banco-de-teste';
import { inserirOrdem, salvarCliente } from '../../support/dados-de-teste';

const repo = new ServicoRepositoryAdapter(prisma);
const consultas = new ServicoConsultasAdapter(prisma);

const novoServico = (nome = 'Troca de óleo', centavos = 15990) =>
  Servico.cadastrar({ nome, preco: Dinheiro.deCentavos(centavos) });

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

describe('ServicoRepositoryAdapter', () => {
  it('salva e restaura o serviço com o preço em Dinheiro', async () => {
    const servico = novoServico();
    await repo.salvar(servico);

    const lido = await repo.buscarPorId({ id: servico.id });
    expect(lido?.equals(servico)).toBe(true);
    expect(lido?.preco.centavos).toBe(15990);
    expect(await repo.buscarPorId({ id: 'inexistente' })).toBeNull();
  });

  it('salvar de novo atualiza em vez de duplicar', async () => {
    const servico = novoServico();
    await repo.salvar(servico);
    servico.atualizar({ nome: 'Alinhamento', preco: Dinheiro.deCentavos(9000) });
    await repo.salvar(servico);

    const lido = await repo.buscarPorId({ id: servico.id });
    expect([lido?.nome, lido?.preco.centavos]).toEqual(['Alinhamento', 9000]);
    expect(await prisma.servico.count()).toBe(1);
  });

  it('remove o serviço; remover de novo não falha', async () => {
    const servico = novoServico();
    await repo.salvar(servico);
    await repo.remover({ id: servico.id });
    await repo.remover({ id: servico.id });

    expect(await repo.buscarPorId({ id: servico.id })).toBeNull();
  });

  it('remover serviço usado em OS vira ConflitoError e preserva o serviço', async () => {
    const ana = await salvarCliente();
    const veiculo = Veiculo.registrar({ clienteId: ana.id, placa: 'ABC1D23', marca: 'VW', modelo: 'Gol', ano: 2020 });
    await new VeiculoRepositoryAdapter(prisma).salvar(veiculo);
    const servico = novoServico();
    await repo.salvar(servico);
    await inserirOrdem({ clienteId: ana.id, veiculoId: veiculo.id, servicoId: servico.id });

    expect(repo.remover({ id: servico.id })).rejects.toThrow(
      new ConflitoError('Serviço já foi utilizado em ordens de serviço'),
    );
    expect(await repo.buscarPorId({ id: servico.id })).not.toBeNull();
  });
});

describe('ServicoConsultasAdapter', () => {
  it('lista por nome com preço em centavos', async () => {
    await repo.salvar(novoServico('Troca de óleo', 15990));
    await repo.salvar(novoServico('Alinhamento', 9000));

    const lista = await consultas.listar();
    expect(lista.map((s) => s.nome)).toEqual(['Alinhamento', 'Troca de óleo']);
    expect(Object.keys(lista[0]!).sort()).toEqual(['id', 'nome', 'precoCentavos']);
    expect(lista[0]!.precoCentavos).toBe(9000);
  });

  it('obtém por id e devolve null quando não existe', async () => {
    const servico = novoServico();
    await repo.salvar(servico);

    expect(await consultas.obter({ id: servico.id })).toEqual({ id: servico.id, nome: 'Troca de óleo', precoCentavos: 15990 });
    expect(await consultas.obter({ id: 'inexistente' })).toBeNull();
  });
});
