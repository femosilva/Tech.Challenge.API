import { beforeEach, describe, expect, test } from 'bun:test';
import { AtualizarVeiculo } from '@application/cadastro/atualizar-veiculo.use-case';
import { NaoEncontradoError } from '@application/core/erros';
import { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import { DomainError } from '@domain/core/domain-error';
import { PublicadorEventosEmMemoria } from '../doubles/publicador-eventos-memoria.test';
import { VeiculoRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';

describe('AtualizarVeiculo', () => {
  let veiculos: VeiculoRepositorioEmMemoria;
  let atualizar: AtualizarVeiculo;
  let veiculo: Veiculo;

  beforeEach(async () => {
    veiculos = new VeiculoRepositorioEmMemoria();
    atualizar = new AtualizarVeiculo(veiculos, new PublicadorEventosEmMemoria());
    veiculo = Veiculo.registrar({ clienteId: 'c1', placa: 'ABC1D23', marca: 'Fiat', modelo: 'Uno', ano: 2015 });
    await veiculos.salvar(veiculo);
  });

  test('atualiza só os campos informados', async () => {
    await atualizar.executar({ id: veiculo.id, modelo: 'Palio' });

    const salvo = (await veiculos.buscarPorId({ id: veiculo.id }))!;
    expect(salvo.modelo).toBe('Palio');
    expect(salvo.marca).toBe('Fiat');
    expect(salvo.ano).toBe(2015);
    expect(salvo.placa.valor).toBe('ABC1D23');
  });

  test('veículo inexistente vira NaoEncontradoError', async () => {
    await expect(atualizar.executar({ id: 'nao-existe', marca: 'VW' })).rejects.toBeInstanceOf(NaoEncontradoError);
  });

  test('dado inválido vira DomainError e nada muda', async () => {
    await expect(atualizar.executar({ id: veiculo.id, marca: 'VW', ano: 1800 })).rejects.toBeInstanceOf(DomainError);

    const salvo = (await veiculos.buscarPorId({ id: veiculo.id }))!;
    expect(salvo.marca).toBe('Fiat');
    expect(salvo.ano).toBe(2015);
  });
});
