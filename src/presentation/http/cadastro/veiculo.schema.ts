import { inteiro } from '@presentation/http/comum';
import { t } from 'elysia';

// Aqui só o formato; as regras de negócio (placa válida, ano plausível, textos obrigatórios) vivem no domínio.
const texto = (exemplo: string) => t.String({ minLength: 1, maxLength: 60, examples: [exemplo] });
const ano = inteiro({ description: 'De 1900 até o ano seguinte ao atual', examples: [2020] });

export const cadastrarVeiculoBody = t.Object({
  clienteId: t.String({ minLength: 1, maxLength: 64 }),
  placa: t.String({
    minLength: 1,
    maxLength: 16,
    description: 'Padrão antigo (ABC-1234) ou Mercosul (ABC1D23)',
    examples: ['ABC1D23'],
  }),
  marca: texto('Volkswagen'),
  modelo: texto('Gol'),
  ano,
});

/** Placa e cliente são imutáveis: enviá-los é um erro de formato (400), não um campo ignorado. */
export const atualizarVeiculoBody = t.Object({
  marca: t.Optional(texto('Volkswagen')),
  modelo: t.Optional(texto('Gol')),
  ano: t.Optional(ano),
});

export const veiculoResposta = t.Object({
  id: t.String(),
  clienteId: t.String(),
  placa: t.String({ description: 'Sem hífen e em maiúsculas', examples: ['ABC1D23'] }),
  marca: t.String(),
  modelo: t.String(),
  ano: inteiro(),
});
