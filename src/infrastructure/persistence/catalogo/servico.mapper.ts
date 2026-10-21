import { Servico } from '@domain/catalogo/servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import type { Servico as ServicoLinha } from '@infrastructure/persistence/generated/client';

export function paraDominio(linha: ServicoLinha): Servico {
  return Servico.restaurar({ id: linha.id, nome: linha.nome, preco: Dinheiro.deCentavos(linha.precoCentavos) });
}

export function paraLinha(servico: Servico): ServicoLinha {
  return { id: servico.id, nome: servico.nome, precoCentavos: servico.preco.centavos };
}
