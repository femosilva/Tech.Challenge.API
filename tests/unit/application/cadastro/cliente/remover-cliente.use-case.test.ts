import { beforeEach, describe, expect, test } from 'bun:test';
import { RemoverCliente } from '@application/cadastro/cliente/remover-cliente.use-case';
import { ConflitoError, NaoEncontradoError } from '@application/core/erros';
import { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { OrdemServicoConsultasEmMemoria, VeiculoConsultasEmMemoria } from '../../doubles/consultas-em-memoria';
import {
  ClienteRepositorioEmMemoria,
  OrdemServicoRepositorioEmMemoria,
  VeiculoRepositorioEmMemoria,
} from '../../doubles/repositorios-em-memoria.test';

describe('RemoverCliente', () => {
  let clientes: ClienteRepositorioEmMemoria;
  let veiculos: VeiculoRepositorioEmMemoria;
  let ordens: OrdemServicoRepositorioEmMemoria;
  let remover: RemoverCliente;
  let cliente: Cliente;

  beforeEach(async () => {
    clientes = new ClienteRepositorioEmMemoria();
    veiculos = new VeiculoRepositorioEmMemoria();
    ordens = new OrdemServicoRepositorioEmMemoria();
    remover = new RemoverCliente(
      clientes,
      new VeiculoConsultasEmMemoria(veiculos),
      new OrdemServicoConsultasEmMemoria(ordens),
    );
    cliente = Cliente.cadastrar({ nome: 'Maria', documento: '529.982.247-25' });
    await clientes.salvar(cliente);
  });

  test('remove cliente sem veículos nem ordens', async () => {
    await remover.executar({ id: cliente.id });
    expect(await clientes.buscarPorId({ id: cliente.id })).toBeNull();
  });

  test('cliente inexistente vira NaoEncontradoError', async () => {
    await expect(remover.executar({ id: 'nao-existe' })).rejects.toBeInstanceOf(NaoEncontradoError);
  });

  test('recusa remover cliente que tem veículos', async () => {
    await veiculos.salvar(
      Veiculo.registrar({ clienteId: cliente.id, placa: 'ABC1D23', marca: 'Fiat', modelo: 'Uno', ano: 2015 }),
    );
    await expect(remover.executar({ id: cliente.id })).rejects.toThrow('Cliente possui veículos');
    expect(await clientes.buscarPorId({ id: cliente.id })).not.toBeNull();
  });

  test('recusa remover cliente que tem ordens de serviço', async () => {
    await ordens.salvar(OrdemServico.abrir({ clienteId: cliente.id, veiculoId: 'v1' }));
    const tentativa = remover.executar({ id: cliente.id });
    await expect(tentativa).rejects.toBeInstanceOf(ConflitoError);
    await expect(tentativa).rejects.toThrow('Cliente possui ordens de serviço');
    expect(await clientes.buscarPorId({ id: cliente.id })).not.toBeNull();
  });
});
