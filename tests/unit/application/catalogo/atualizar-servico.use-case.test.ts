import { beforeEach, describe, expect, test } from 'bun:test';
import { AtualizarServico } from '@application/catalogo/atualizar-servico.use-case';
import { NaoEncontradoError } from '@application/core/erros';
import { Servico } from '@domain/catalogo/servico.aggregate';
import { DomainError } from '@domain/core/domain-error';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { PublicadorEventosEmMemoria } from '../doubles/publicador-eventos-memoria.test';
import { ServicoRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';

describe('AtualizarServico', () => {
  let servicos: ServicoRepositorioEmMemoria;
  let atualizar: AtualizarServico;
  let servico: Servico;

  beforeEach(async () => {
    servicos = new ServicoRepositorioEmMemoria();
    atualizar = new AtualizarServico(servicos, new PublicadorEventosEmMemoria());
    servico = Servico.cadastrar({ nome: 'Troca de óleo', preco: Dinheiro.deCentavos(15000) });
    await servicos.salvar(servico);
  });

  test('atualiza só o preço', async () => {
    await atualizar.executar({ id: servico.id, precoCentavos: 18000 });

    const salvo = (await servicos.buscarPorId({ id: servico.id }))!;
    expect(salvo.preco.centavos).toBe(18000);
    expect(salvo.nome).toBe('Troca de óleo');
  });

  test('atualiza só o nome', async () => {
    await atualizar.executar({ id: servico.id, nome: 'Troca de óleo e filtro' });

    const salvo = (await servicos.buscarPorId({ id: servico.id }))!;
    expect(salvo.nome).toBe('Troca de óleo e filtro');
    expect(salvo.preco.centavos).toBe(15000);
  });

  test('serviço inexistente vira NaoEncontradoError', async () => {
    await expect(atualizar.executar({ id: 'nao-existe', nome: 'X' })).rejects.toBeInstanceOf(NaoEncontradoError);
  });

  test('preço inválido vira DomainError e nada muda', async () => {
    await expect(atualizar.executar({ id: servico.id, nome: 'Novo', precoCentavos: -5 })).rejects.toBeInstanceOf(
      DomainError,
    );

    const salvo = (await servicos.buscarPorId({ id: servico.id }))!;
    expect(salvo.nome).toBe('Troca de óleo');
    expect(salvo.preco.centavos).toBe(15000);
  });
});
