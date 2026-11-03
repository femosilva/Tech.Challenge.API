import { inteiro, inteiroDoBanco } from '@presentation/http/comum';
import { t } from 'elysia';

// Aqui só o formato e o limite técnico do banco; sinal, saldo e código obrigatório vivem no domínio.
const codigo = t.String({ minLength: 1, maxLength: 64, examples: ['FO-001'] });
const nome = t.String({ minLength: 1, maxLength: 200, examples: ['Filtro de óleo'] });
const preco = inteiroDoBanco({ description: 'Preço em centavos', examples: [4000] });

export const cadastrarPecaBody = t.Object({
  codigo,
  nome,
  precoCentavos: preco,
  saldoInicial: t.Optional(inteiroDoBanco({ description: 'Saldo inicial em estoque (padrão 0)', examples: [10] })),
});

/** O código identifica a peça e o saldo só muda por reposição ou baixa: enviá-los aqui é 400. */
export const atualizarPecaBody = t.Object({ nome: t.Optional(nome), precoCentavos: t.Optional(preco) });

export const reporEstoqueBody = t.Object({
  quantidade: inteiroDoBanco({ description: 'Unidades a somar ao saldo (maior que zero)', examples: [10] }),
});

export const pecaResposta = t.Object({
  id: t.String(),
  codigo: t.String(),
  nome: t.String(),
  precoCentavos: inteiro({ description: 'Preço em centavos' }),
  saldo: inteiro({ description: 'Unidades em estoque' }),
});
