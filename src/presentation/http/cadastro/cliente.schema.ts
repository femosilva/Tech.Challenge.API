import { t } from 'elysia';

// Aqui só o formato; as regras de negócio (CPF/CNPJ válido, nome obrigatório) vivem no domínio.
const nome = t.String({ minLength: 1, maxLength: 200, examples: ['Ana Souza'] });

export const cadastrarClienteBody = t.Object({
  nome,
  documento: t.String({
    minLength: 1,
    maxLength: 32,
    description: 'CPF ou CNPJ, com ou sem máscara',
    examples: ['529.982.247-25'],
  }),
});

export const renomearClienteBody = t.Object({ nome });

export const clienteResposta = t.Object({
  id: t.String(),
  nome: t.String(),
  documento: t.String({ description: 'Sem máscara e em maiúsculas', examples: ['52998224725'] }),
});
