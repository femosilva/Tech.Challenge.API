import type { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import type { VeiculoEvent } from './veiculo.events';
import { AggregateRoot } from '@domain/core/aggregate-root';
import { DomainError } from '@domain/core/domain-error';
import { Placa } from '@domain/value-objects/placa.vo';

type Dados = Pick<Veiculo, 'clienteId' | 'marca' | 'modelo' | 'ano'> & { placa: string };

export class Veiculo extends AggregateRoot<VeiculoEvent> {
  private constructor(
    id: string,
    readonly clienteId: Cliente['id'],
    readonly placa: Placa,
    private _marca: string,
    private _modelo: string,
    private _ano: number,
  ) {
    super(id);
  }

  static registrar(dados: Dados, agora = new Date()): Veiculo {
    if (!dados.clienteId) throw new DomainError('Veículo deve pertencer a um cliente');
    const veiculo = new Veiculo(
      Veiculo.gerarId(),
      dados.clienteId,
      Placa.criar(dados.placa),
      Veiculo.texto(dados.marca, 'Marca é obrigatória'),
      Veiculo.texto(dados.modelo, 'Modelo é obrigatório'),
      Veiculo.anoValido(dados.ano, agora),
    );
    veiculo.registrar({
      nome: 'VeiculoRegistrado',
      ocorridoEm: agora,
      veiculoId: veiculo.id,
      clienteId: veiculo.clienteId,
    });
    return veiculo;
  }

  /** Reconstrói a partir da persistência; não gera evento. */
  static restaurar(dados: Dados & Pick<Veiculo, 'id'>): Veiculo {
    return new Veiculo(
      dados.id,
      dados.clienteId,
      Placa.criar(dados.placa),
      dados.marca,
      dados.modelo,
      dados.ano,
    );
  }

  get marca(): string {
    return this._marca;
  }

  get modelo(): string {
    return this._modelo;
  }

  get ano(): number {
    return this._ano;
  }

  /** Valida tudo antes de alterar qualquer campo: ou muda por inteiro, ou não muda. */
  atualizar(dados: Partial<Pick<Veiculo, 'marca' | 'modelo' | 'ano'>>, agora = new Date()): void {
    const marca = Veiculo.texto(dados.marca ?? this._marca, 'Marca é obrigatória');
    const modelo = Veiculo.texto(dados.modelo ?? this._modelo, 'Modelo é obrigatório');
    const ano = Veiculo.anoValido(dados.ano ?? this._ano, agora);
    this._marca = marca;
    this._modelo = modelo;
    this._ano = ano;
  }

  private static texto(valor: string, mensagem: string): string {
    const normalizado = valor?.trim();
    if (!normalizado) throw new DomainError(mensagem);
    return normalizado;
  }

  /** Aceita até o ano seguinte ao atual (modelo do próximo ano). */
  private static anoValido(ano: number, agora: Date): number {
    if (!Number.isInteger(ano) || ano < 1900 || ano > agora.getFullYear() + 1) {
      throw new DomainError('Ano do veículo inválido');
    }
    return ano;
  }
}
