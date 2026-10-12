import { beforeEach, describe, expect, test } from 'bun:test';
import { ListarServicos } from '@application/catalogo/listar-servicos.use-case';
import { ObterServico } from '@application/catalogo/obter-servico.use-case';
import { NaoEncontradoError } from '@application/core/erros';
import { Servico } from '@domain/catalogo/servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { ServicoConsultasEmMemoria } from '../doubles/consultas-em-memoria';
import { ServicoRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';

describe('consultas de serviço', () => {
  let servicos: ServicoRepositorioEmMemoria;
  let obter: ObterServico;
  let listar: ListarServicos;
  let oleo: Servico;

  beforeEach(async () => {
    servicos = new ServicoRepositorioEmMemoria();
    const consultas = new ServicoConsultasEmMemoria(servicos);
    obter = new ObterServico(consultas);
    listar = new ListarServicos(consultas);
    oleo = Servico.cadastrar({ nome: 'Troca de óleo', preco: Dinheiro.deCentavos(15000) });
    await servicos.salvar(oleo);
    await servicos.salvar(Servico.cadastrar({ nome: 'Alinhamento', preco: Dinheiro.deCentavos(8000) }));
  });

  test('ObterServico devolve o DTO com o preço em centavos', async () => {
    expect(await obter.executar({ id: oleo.id })).toEqual({ id: oleo.id, nome: 'Troca de óleo', precoCentavos: 15000 });
  });

  test('ObterServico com id inexistente vira NaoEncontradoError', async () => {
    await expect(obter.executar({ id: 'nao-existe' })).rejects.toBeInstanceOf(NaoEncontradoError);
  });

  test('ListarServicos devolve todos', async () => {
    expect((await listar.executar()).map((s) => s.nome).sort()).toEqual(['Alinhamento', 'Troca de óleo']);
  });
});
