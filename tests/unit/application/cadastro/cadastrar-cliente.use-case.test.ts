import { beforeEach, describe, expect, test } from 'bun:test';
import { CadastrarCliente } from '@application/cadastro/cadastrar-cliente.use-case';
import { ConflitoError } from '@application/core/erros';
import { DomainError } from '@domain/core/domain-error';
import { ClienteRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';
import { PublicadorEventosEmMemoria } from '../doubles/publicador-eventos-memoria.test';

const CPF = '529.982.247-25';
const CPF_SEM_MASCARA = '52998224725';

describe('CadastrarCliente', () => {
  let clientes: ClienteRepositorioEmMemoria;
  let eventos: PublicadorEventosEmMemoria;
  let cadastrar: CadastrarCliente;

  beforeEach(() => {
    clientes = new ClienteRepositorioEmMemoria();
    eventos = new PublicadorEventosEmMemoria();
    cadastrar = new CadastrarCliente(clientes, eventos);
  });

  test('cadastra, devolve o id e publica ClienteCadastrado', async () => {
    const { id } = await cadastrar.executar({ nome: '  Maria  ', documento: CPF });

    const salvo = await clientes.buscarPorId({ id });
    expect(salvo?.nome).toBe('Maria');
    expect(salvo?.documento.numero).toBe(CPF_SEM_MASCARA);
    expect(eventos.nomes).toEqual(['ClienteCadastrado']);
  });

  test('rejeita documento já cadastrado, mesmo com máscara diferente, sem publicar outro evento', async () => {
    await cadastrar.executar({ nome: 'Maria', documento: CPF });

    await expect(cadastrar.executar({ nome: 'Outra', documento: CPF_SEM_MASCARA })).rejects.toBeInstanceOf(
      ConflitoError,
    );
    expect(eventos.publicados).toHaveLength(1);
  });

  test('documento inválido vira DomainError e nada é salvo', async () => {
    await expect(cadastrar.executar({ nome: 'Maria', documento: '111.111.111-11' })).rejects.toBeInstanceOf(
      DomainError,
    );
    expect(eventos.publicados).toHaveLength(0);
  });

  test('nome vazio vira DomainError', async () => {
    await expect(cadastrar.executar({ nome: '   ', documento: CPF })).rejects.toBeInstanceOf(DomainError);
  });
});
