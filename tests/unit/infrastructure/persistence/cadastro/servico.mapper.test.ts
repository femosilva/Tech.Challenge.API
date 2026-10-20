import { describe, expect, it } from 'bun:test';
import { Servico } from '@domain/catalogo/servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import * as ServicoMapper from '@infrastructure/persistence/catalogo/servico.mapper';

describe('ServicoMapper', () => {
  it('ida e volta converte o preço entre Dinheiro e centavos', () => {
    const servico = Servico.cadastrar({ nome: 'Troca de óleo', preco: Dinheiro.deCentavos(15990) });
    const linha = ServicoMapper.paraLinha(servico);
    expect(linha).toEqual({ id: servico.id, nome: 'Troca de óleo', precoCentavos: 15990 });

    const restaurado = ServicoMapper.paraDominio(linha);
    expect(restaurado.preco.centavos).toBe(15990);
    expect(restaurado.puxarEventos()).toEqual([]);
  });
});
