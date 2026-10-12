import { beforeEach, describe, expect, test } from 'bun:test';
import { ListarClientes } from '@application/cadastro/listar-clientes.use-case';
import { ObterCliente } from '@application/cadastro/obter-cliente.use-case';
import { NaoEncontradoError } from '@application/core/erros';
import { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import { ClienteConsultasEmMemoria } from '../doubles/consultas-em-memoria';
import { ClienteRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';

describe('consultas de cliente', () => {
  let clientes: ClienteRepositorioEmMemoria;
  let obter: ObterCliente;
  let listar: ListarClientes;
  let maria: Cliente;

  beforeEach(async () => {
    clientes = new ClienteRepositorioEmMemoria();
    const consultas = new ClienteConsultasEmMemoria(clientes);
    obter = new ObterCliente(consultas);
    listar = new ListarClientes(consultas);
    maria = Cliente.cadastrar({ nome: 'Maria', documento: '529.982.247-25' });
    await clientes.salvar(maria);
  });

  test('ObterCliente devolve o DTO com documento sem máscara', async () => {
    expect(await obter.executar({ id: maria.id })).toEqual({
      id: maria.id,
      nome: 'Maria',
      documento: '52998224725',
    });
  });

  test('ObterCliente com id inexistente vira NaoEncontradoError', async () => {
    await expect(obter.executar({ id: 'nao-existe' })).rejects.toBeInstanceOf(NaoEncontradoError);
  });

  test('ListarClientes devolve todos os clientes como DTOs', async () => {
    const joao = Cliente.cadastrar({ nome: 'João', documento: '11.222.333/0001-81' });
    await clientes.salvar(joao);

    const lista = await listar.executar();
    expect(lista.map((c) => c.nome).sort()).toEqual(['João', 'Maria']);
    expect(lista.find((c) => c.id === joao.id)?.documento).toBe('11222333000181');
  });

  test('ListarClientes sem clientes devolve lista vazia', async () => {
    expect(await new ListarClientes(new ClienteConsultasEmMemoria(new ClienteRepositorioEmMemoria())).executar()).toEqual([]);
  });
});
