import { beforeEach, describe, expect, test } from 'bun:test';
import { ReferenciaInvalidaError } from '@application/core/erros';
import { AbrirOS } from '@application/ordem-servico/abrir-os.use-case';
import { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import { DomainError } from '@domain/core/domain-error';
import { PublicadorEventosEmMemoria } from '../doubles/publicador-eventos-memoria.test';
import {
  ClienteRepositorioEmMemoria,
  OrdemServicoRepositorioEmMemoria,
  VeiculoRepositorioEmMemoria,
} from '../doubles/repositorios-em-memoria.test';

const CPF_MARIA = '529.982.247-25';
const CNPJ_JOAO = '11.222.333/0001-81';

describe('AbrirOS', () => {
  let clientes: ClienteRepositorioEmMemoria;
  let veiculos: VeiculoRepositorioEmMemoria;
  let ordens: OrdemServicoRepositorioEmMemoria;
  let eventos: PublicadorEventosEmMemoria;
  let abrir: AbrirOS;
  let maria: Cliente;
  let uno: Veiculo;

  beforeEach(async () => {
    clientes = new ClienteRepositorioEmMemoria();
    veiculos = new VeiculoRepositorioEmMemoria();
    ordens = new OrdemServicoRepositorioEmMemoria();
    eventos = new PublicadorEventosEmMemoria();
    abrir = new AbrirOS(clientes, veiculos, ordens, eventos);

    maria = Cliente.cadastrar({ nome: 'Maria', documento: CPF_MARIA });
    await clientes.salvar(maria);
    await clientes.salvar(Cliente.cadastrar({ nome: 'João Ltda', documento: CNPJ_JOAO }));
    uno = Veiculo.registrar({ clienteId: maria.id, placa: 'ABC1D23', marca: 'Fiat', modelo: 'Uno', ano: 2015 });
    await veiculos.salvar(uno);
  });

  test('abre a OS como Recebida para o cliente e o veículo identificados e publica OSAberta', async () => {
    const { id } = await abrir.executar({ documento: CPF_MARIA, placa: 'ABC1D23' });

    const os = (await ordens.buscarPorId({ id }))!;
    expect(os.status.valor).toBe('RECEBIDA');
    expect(os.clienteId).toBe(maria.id);
    expect(os.veiculoId).toBe(uno.id);
    expect(eventos.nomes).toEqual(['OSAberta']);
  });

  test('aceita documento sem máscara e placa em outro formato', async () => {
    const { id } = await abrir.executar({ documento: '52998224725', placa: 'abc-1d23' });
    expect(await ordens.buscarPorId({ id })).not.toBeNull();
  });

  test('documento sem cliente cadastrado vira ReferenciaInvalidaError', async () => {
    await expect(abrir.executar({ documento: '111.444.777-35', placa: 'ABC1D23' })).rejects.toBeInstanceOf(
      ReferenciaInvalidaError,
    );
    expect(eventos.publicados).toHaveLength(0);
  });

  test('placa sem veículo cadastrado vira ReferenciaInvalidaError', async () => {
    await expect(abrir.executar({ documento: CPF_MARIA, placa: 'XYZ9K87' })).rejects.toBeInstanceOf(
      ReferenciaInvalidaError,
    );
    expect(eventos.publicados).toHaveLength(0);
  });

  test('veículo de outro cliente vira ReferenciaInvalidaError', async () => {
    const tentativa = abrir.executar({ documento: CNPJ_JOAO, placa: 'ABC1D23' });

    await expect(tentativa).rejects.toBeInstanceOf(ReferenciaInvalidaError);
    await expect(tentativa).rejects.toThrow('Veículo não pertence ao cliente');
    expect(eventos.publicados).toHaveLength(0);
  });

  test('documento inválido vira DomainError', async () => {
    await expect(abrir.executar({ documento: '111.111.111-11', placa: 'ABC1D23' })).rejects.toBeInstanceOf(DomainError);
  });

  test('placa inválida vira DomainError', async () => {
    await expect(abrir.executar({ documento: CPF_MARIA, placa: '123' })).rejects.toBeInstanceOf(DomainError);
  });
});
