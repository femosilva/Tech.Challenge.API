import { beforeEach, describe, expect, test } from 'bun:test';
import { RenomearCliente } from '@application/cadastro/renomear-cliente';
import { NaoEncontradoError } from '@application/core/erros';
import { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import { DomainError } from '@domain/core/domain-error';
import { PublicadorEventosEmMemoria } from '../doubles/publicador-eventos-memoria.test';
import { ClienteRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';

describe('RenomearCliente', () => {
  let clientes: ClienteRepositorioEmMemoria;
  let eventos: PublicadorEventosEmMemoria;
  let renomear: RenomearCliente;
  let cliente: Cliente;

  beforeEach(async () => {
    clientes = new ClienteRepositorioEmMemoria();
    eventos = new PublicadorEventosEmMemoria();
    renomear = new RenomearCliente(clientes, eventos);
    cliente = Cliente.cadastrar({ nome: 'Maria', documento: '529.982.247-25' });
    await clientes.salvar(cliente);
  });

  test('renomeia e persiste', async () => {
    await renomear.executar({ id: cliente.id, nome: '  Maria Souza ' });
    expect((await clientes.buscarPorId({ id: cliente.id }))?.nome).toBe('Maria Souza');
  });

  test('cliente inexistente vira NaoEncontradoError', async () => {
    await expect(renomear.executar({ id: 'nao-existe', nome: 'X' })).rejects.toBeInstanceOf(NaoEncontradoError);
  });

  test('nome vazio vira DomainError e o nome guardado não muda', async () => {
    await expect(renomear.executar({ id: cliente.id, nome: '  ' })).rejects.toBeInstanceOf(DomainError);
    expect((await clientes.buscarPorId({ id: cliente.id }))?.nome).toBe('Maria');
  });
});
