import { beforeEach, describe, expect, test } from 'bun:test';
import { CadastrarServico } from '@application/catalogo/cadastrar-servico.use-case';
import { DomainError } from '@domain/core/domain-error';
import { PublicadorEventosEmMemoria } from '../doubles/publicador-eventos-memoria.test';
import { ServicoRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';

describe('CadastrarServico', () => {
  let servicos: ServicoRepositorioEmMemoria;
  let eventos: PublicadorEventosEmMemoria;
  let cadastrar: CadastrarServico;

  beforeEach(() => {
    servicos = new ServicoRepositorioEmMemoria();
    eventos = new PublicadorEventosEmMemoria();
    cadastrar = new CadastrarServico(servicos, eventos);
  });

  test('cadastra com o preço em centavos, devolve o id e publica ServicoCadastrado', async () => {
    const { id } = await cadastrar.executar({ nome: '  Troca de óleo ', precoCentavos: 15000 });

    const salvo = (await servicos.buscarPorId({ id }))!;
    expect(salvo.nome).toBe('Troca de óleo');
    expect(salvo.preco.centavos).toBe(15000);
    expect(eventos.nomes).toEqual(['ServicoCadastrado']);
  });

  test.each([-1, 10.5, Number.NaN])('preço %p vira DomainError', async (precoCentavos) => {
    await expect(cadastrar.executar({ nome: 'Alinhamento', precoCentavos })).rejects.toBeInstanceOf(DomainError);
    expect(eventos.publicados).toHaveLength(0);
  });

  test('preço zero vira DomainError', async () => {
    await expect(cadastrar.executar({ nome: 'Alinhamento', precoCentavos: 0 })).rejects.toBeInstanceOf(DomainError);
  });

  test('nome vazio vira DomainError', async () => {
    await expect(cadastrar.executar({ nome: ' ', precoCentavos: 100 })).rejects.toBeInstanceOf(DomainError);
  });
});
