import { t } from 'elysia';

/** Formato único de erro da API. Também alimenta a documentação OpenAPI das respostas de erro. */
export const erroResposta = t.Object({
  erro: t.Object({
    codigo: t.String(),
    mensagem: t.String(),
    detalhes: t.Optional(t.Array(t.Object({ campo: t.String(), mensagem: t.String() }))),
  }),
});
