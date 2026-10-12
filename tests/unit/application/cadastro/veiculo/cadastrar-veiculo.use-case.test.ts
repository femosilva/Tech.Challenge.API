import { beforeEach, describe, expect, test } from 'bun:test';
import { CadastrarVeiculo } from '@application/cadastro/veiculo/cadastrar-veiculo.use-case';
import { ConflitoError, ReferenciaInvalidaError } from '@application/core/erros';
import { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import { DomainError } from '@domain/core/domain-error';
import { PublicadorEventosEmMemoria } from '../../doubles/publicador-eventos-memoria.test';
import { ClienteRepositorioEmMemoria, VeiculoRepositorioEmMemoria } from '../../doubles/repositorios-em-memoria.test';

describe('CadastrarVeiculo', () => {
  let veiculos: VeiculoRepositorioEmMemoria;
  let clientes: ClienteRepositorioEmMemoria;
  let eventos: PublicadorEventosEmMemoria;
  let cadastrar: CadastrarVeiculo;
  let cliente: Cliente;

  const dados = () => ({ clienteId: cliente.id, placa: 'ABC1D23', marca: 'Fiat', modelo: 'Uno', ano: 2015 });

  beforeEach(async () => {
    veiculos = new VeiculoRepositorioEmMemoria();
    clientes = new ClienteRepositorioEmMemoria();
    eventos = new PublicadorEventosEmMemoria();
    cadastrar = new CadastrarVeiculo(veiculos, clientes, eventos);
    cliente = Cliente.cadastrar({ nome: 'Maria', documento: '529.982.247-25' });
    await clientes.salvar(cliente);
  });

  test('cadastra, devolve o id e publica VeiculoRegistrado', async () => {
    const { id } = await cadastrar.executar({ ...dados(), placa: 'abc-1d23' });

    const salvo = await veiculos.buscarPorId({ id });
    expect(salvo?.placa.valor).toBe('ABC1D23');
    expect(salvo?.clienteId).toBe(cliente.id);
    expect(eventos.nomes).toEqual(['VeiculoRegistrado']);
  });

  test('cliente inexistente vira ReferenciaInvalidaError e nada é publicado', async () => {
    await expect(cadastrar.executar({ ...dados(), clienteId: 'nao-existe' })).rejects.toBeInstanceOf(
      ReferenciaInvalidaError,
    );
    expect(eventos.publicados).toHaveLength(0);
  });

  test('placa já cadastrada vira ConflitoError, mesmo escrita de outro jeito', async () => {
    await cadastrar.executar(dados());

    await expect(cadastrar.executar({ ...dados(), placa: 'abc-1d23' })).rejects.toBeInstanceOf(ConflitoError);
    expect(eventos.publicados).toHaveLength(1);
  });

  test('placa inválida vira DomainError', async () => {
    await expect(cadastrar.executar({ ...dados(), placa: '123' })).rejects.toBeInstanceOf(DomainError);
  });

  test('dados inválidos do veículo viram DomainError antes de consultar o cliente', async () => {
    await expect(cadastrar.executar({ ...dados(), clienteId: 'nao-existe', marca: '  ' })).rejects.toBeInstanceOf(
      DomainError,
    );
  });
});
