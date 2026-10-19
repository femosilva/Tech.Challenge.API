import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { ConflitoError } from '@application/core/erros';
import { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import { CpfCnpj } from '@domain/value-objects/cpf-cnpj.vo';
import { ClienteConsultasAdapter } from '@infrastructure/persistence/cadastro/cliente/cliente-consultas.adapter';
import { ClienteRepositoryAdapter } from '@infrastructure/persistence/cadastro/cliente/cliente-repository.adapter';
import { limparBanco, prisma } from '../../support/banco-de-teste';

const CPF_ANA = '529.982.247-25';
const CPF_BIA = '111.444.777-35';

const repo = new ClienteRepositoryAdapter(prisma);
const consultas = new ClienteConsultasAdapter(prisma);

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

describe('ClienteRepositoryAdapter', () => {
  it('salva e restaura o cliente com o documento normalizado', async () => {
    const ana = Cliente.cadastrar({ nome: 'Ana', documento: CPF_ANA });
    await repo.salvar(ana);

    const lido = await repo.buscarPorId({ id: ana.id });
    expect(lido?.equals(ana)).toBe(true);
    expect(lido?.nome).toBe('Ana');
    expect(lido?.documento.numero).toBe('52998224725');
  });

  it('salvar de novo atualiza em vez de duplicar', async () => {
    const ana = Cliente.cadastrar({ nome: 'Ana', documento: CPF_ANA });
    await repo.salvar(ana);
    ana.renomear('Ana Souza');
    await repo.salvar(ana);

    expect((await repo.buscarPorId({ id: ana.id }))?.nome).toBe('Ana Souza');
    expect(await prisma.cliente.count()).toBe(1);
  });

  it('busca por documento e devolve null quando não existe', async () => {
    const ana = Cliente.cadastrar({ nome: 'Ana', documento: CPF_ANA });
    await repo.salvar(ana);

    expect((await repo.buscarPorDocumento({ documento: CpfCnpj.criar('52998224725') }))?.id).toBe(ana.id);
    expect(await repo.buscarPorDocumento({ documento: CpfCnpj.criar(CPF_BIA) })).toBeNull();
    expect(await repo.buscarPorId({ id: 'inexistente' })).toBeNull();
  });

  it('documento repetido (corrida entre duas requisições) vira ConflitoError', async () => {
    await repo.salvar(Cliente.cadastrar({ nome: 'Ana', documento: CPF_ANA }));
    const outra = Cliente.cadastrar({ nome: 'Outra Ana', documento: CPF_ANA });

    expect(repo.salvar(outra)).rejects.toThrow(new ConflitoError('Já existe cliente com este documento'));
  });

  it('remove o cliente; remover de novo não falha', async () => {
    const ana = Cliente.cadastrar({ nome: 'Ana', documento: CPF_ANA });
    await repo.salvar(ana);
    await repo.remover({ id: ana.id });
    await repo.remover({ id: ana.id });

    expect(await repo.buscarPorId({ id: ana.id })).toBeNull();
  });

  it('remover cliente com veículo vira ConflitoError e preserva o cliente', async () => {
    const ana = Cliente.cadastrar({ nome: 'Ana', documento: CPF_ANA });
    await repo.salvar(ana);
    await prisma.veiculo.create({
      data: { id: 'v1', clienteId: ana.id, placa: 'ABC1D23', marca: 'VW', modelo: 'Gol', ano: 2020 },
    });

    expect(repo.remover({ id: ana.id })).rejects.toBeInstanceOf(ConflitoError);
    expect(await repo.buscarPorId({ id: ana.id })).not.toBeNull();
  });
});

describe('ClienteConsultasAdapter', () => {
  it('lista por nome e devolve DTOs planos', async () => {
    await repo.salvar(Cliente.cadastrar({ nome: 'Bia', documento: CPF_BIA }));
    await repo.salvar(Cliente.cadastrar({ nome: 'Ana', documento: CPF_ANA }));

    const lista = await consultas.listar();
    expect(lista.map((c) => c.nome)).toEqual(['Ana', 'Bia']);
    expect(Object.keys(lista[0]!).sort()).toEqual(['documento', 'id', 'nome']);
    expect(lista[0]!.documento).toBe('52998224725');
  });

  it('obtém por id e devolve null quando não existe', async () => {
    const ana = Cliente.cadastrar({ nome: 'Ana', documento: CPF_ANA });
    await repo.salvar(ana);

    expect(await consultas.obter({ id: ana.id })).toEqual({ id: ana.id, nome: 'Ana', documento: '52998224725' });
    expect(await consultas.obter({ id: 'inexistente' })).toBeNull();
  });
});
