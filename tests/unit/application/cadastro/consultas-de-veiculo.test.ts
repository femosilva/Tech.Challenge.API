import { beforeEach, describe, expect, test } from 'bun:test';
import { ListarVeiculos } from '@application/cadastro/listar-veiculos.use-case';
import { ListarVeiculosDoCliente } from '@application/cadastro/listar-veiculos-do-cliente.use-case';
import { ObterVeiculo } from '@application/cadastro/obter-veiculo.use-case';
import { NaoEncontradoError } from '@application/core/erros';
import { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import { ClienteConsultasEmMemoria, VeiculoConsultasEmMemoria } from '../doubles/consultas-em-memoria';
import { ClienteRepositorioEmMemoria, VeiculoRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';

describe('consultas de veículo', () => {
  let clientes: ClienteRepositorioEmMemoria;
  let veiculos: VeiculoRepositorioEmMemoria;
  let maria: Cliente;
  let joao: Cliente;
  let uno: Veiculo;
  let gol: Veiculo;
  let obter: ObterVeiculo;
  let listar: ListarVeiculos;
  let listarDoCliente: ListarVeiculosDoCliente;

  beforeEach(async () => {
    clientes = new ClienteRepositorioEmMemoria();
    veiculos = new VeiculoRepositorioEmMemoria();
    const consultasCliente = new ClienteConsultasEmMemoria(clientes);
    const consultasVeiculo = new VeiculoConsultasEmMemoria(veiculos);
    obter = new ObterVeiculo(consultasVeiculo);
    listar = new ListarVeiculos(consultasVeiculo);
    listarDoCliente = new ListarVeiculosDoCliente(consultasCliente, consultasVeiculo);

    maria = Cliente.cadastrar({ nome: 'Maria', documento: '529.982.247-25' });
    joao = Cliente.cadastrar({ nome: 'João', documento: '11.222.333/0001-81' });
    await clientes.salvar(maria);
    await clientes.salvar(joao);
    uno = Veiculo.registrar({ clienteId: maria.id, placa: 'ABC1D23', marca: 'Fiat', modelo: 'Uno', ano: 2015 });
    gol = Veiculo.registrar({ clienteId: maria.id, placa: 'DEF-4567', marca: 'VW', modelo: 'Gol', ano: 2010 });
    await veiculos.salvar(uno);
    await veiculos.salvar(gol);
  });

  test('ObterVeiculo devolve o DTO com a placa normalizada', async () => {
    expect(await obter.executar({ id: gol.id })).toEqual({
      id: gol.id,
      clienteId: maria.id,
      placa: 'DEF4567',
      marca: 'VW',
      modelo: 'Gol',
      ano: 2010,
    });
  });

  test('ObterVeiculo com id inexistente vira NaoEncontradoError', async () => {
    await expect(obter.executar({ id: 'nao-existe' })).rejects.toBeInstanceOf(NaoEncontradoError);
  });

  test('ListarVeiculos devolve todos', async () => {
    expect((await listar.executar()).map((v) => v.placa).sort()).toEqual(['ABC1D23', 'DEF4567']);
  });

  test('ListarVeiculosDoCliente devolve só os veículos daquele cliente', async () => {
    expect((await listarDoCliente.executar({ clienteId: maria.id })).map((v) => v.id).sort()).toEqual(
      [uno.id, gol.id].sort(),
    );
    expect(await listarDoCliente.executar({ clienteId: joao.id })).toEqual([]);
  });

  test('ListarVeiculosDoCliente com cliente inexistente vira NaoEncontradoError', async () => {
    await expect(listarDoCliente.executar({ clienteId: 'nao-existe' })).rejects.toBeInstanceOf(NaoEncontradoError);
  });
});
