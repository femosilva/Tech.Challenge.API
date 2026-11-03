import { inteiro, inteiroDoBanco } from '@presentation/http/comum';
import { t } from 'elysia';

// Aqui só o formato e o limite técnico do banco; o sinal do preço e o nome obrigatório vivem no domínio.
const nome = t.String({ minLength: 1, maxLength: 200, examples: ['Troca de óleo'] });
const preco = inteiroDoBanco({ description: 'Preço em centavos', examples: [15000] });

export const cadastrarServicoBody = t.Object({ nome, precoCentavos: preco });

export const atualizarServicoBody = t.Object({ nome: t.Optional(nome), precoCentavos: t.Optional(preco) });

export const servicoResposta = t.Object({
  id: t.String(),
  nome: t.String(),
  precoCentavos: inteiro({ description: 'Preço em centavos' }),
});
