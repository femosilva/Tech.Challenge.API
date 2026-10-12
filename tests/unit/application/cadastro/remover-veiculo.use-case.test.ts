import { beforeEach, describe, expect, test } from 'bun:test';
import { RemoverVeiculo } from '@application/cadastro/remover-veiculo.use-case';
import { ConflitoError, NaoEncontradoError } from '@application/core/erros';
import { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { OrdemServicoConsultasEmMemoria } from '../doubles/consultas-em-memoria';
import { OrdemServicoRepositorioEmMemoria, VeiculoRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';

describe('RemoverVeiculo', () => {
  let veiculos: VeiculoRepositorioEmMemoria;
  let ordens: OrdemServicoRepositorioEmMemoria;
  let remover: RemoverVeiculo;
  let veiculo: Veiculo;

  beforeEach(async () => {
    veiculos = new VeiculoRepositorioEmMemoria();
    ordens = new OrdemServicoRepositorioEmMemoria();
    remover = new RemoverVeiculo(veiculos, new OrdemServicoConsultasEmMemoria(ordens));
    veiculo = Veiculo.registrar({ clienteId: 'c1', placa: 'ABC1D23', marca: 'Fiat', modelo: 'Uno', ano: 2015 });
    await veiculos.salvar(veiculo);
  });

  test('remove veículo sem ordens de serviço', async () => {
    await remover.executar({ id: veiculo.id });
    expect(await veiculos.buscarPorId({ id: veiculo.id })).toBeNull();
  });

  test('veículo inexistente vira NaoEncontradoError', async () => {
    await expect(remover.executar({ id: 'nao-existe' })).rejects.toBeInstanceOf(NaoEncontradoError);
  });

  test('recusa remover veículo que tem ordens de serviço', async () => {
    await ordens.salvar(OrdemServico.abrir({ clienteId: 'c1', veiculoId: veiculo.id }));

    const tentativa = remover.executar({ id: veiculo.id });
    await expect(tentativa).rejects.toBeInstanceOf(ConflitoError);
    await expect(tentativa).rejects.toThrow('Veículo possui ordens de serviço');
    expect(await veiculos.buscarPorId({ id: veiculo.id })).not.toBeNull();
  });

  test('ordem de outro veículo não impede a remoção', async () => {
    await ordens.salvar(OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'outro-veiculo' }));
    await remover.executar({ id: veiculo.id });
    expect(await veiculos.buscarPorId({ id: veiculo.id })).toBeNull();
  });
});
