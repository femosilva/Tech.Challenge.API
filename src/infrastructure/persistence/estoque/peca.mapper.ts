import { Peca } from '@domain/estoque/peca.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import type { Peca as PecaLinha } from '@infrastructure/persistence/generated/client';

export function paraDominio(linha: PecaLinha): Peca {
  return Peca.restaurar({
    id: linha.id,
    codigo: linha.codigo,
    nome: linha.nome,
    preco: Dinheiro.deCentavos(linha.precoCentavos),
    saldo: Quantidade.de(linha.saldo),
  });
}

export function paraLinha(peca: Peca): PecaLinha {
  return {
    id: peca.id,
    codigo: peca.codigo,
    nome: peca.nome,
    precoCentavos: peca.preco.centavos,
    saldo: peca.saldo.valor,
  };
}
