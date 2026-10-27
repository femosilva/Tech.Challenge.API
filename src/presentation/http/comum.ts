import type { Papel } from '@domain/value-objects/papel.vo';
import { t } from 'elysia';

/** O que a rota precisa de um caso de uso: só `executar`. Os testes injetam falsos sem cast. */
export type Executa<T extends { executar: (...args: never[]) => unknown }> = Pick<T, 'executar'>;

/**
 * Inteiro estrito. O `t.Integer()` do Elysia também aceita texto numérico ("2020"), o que não faz sentido
 * num corpo JSON e aparece no OpenAPI como "string ou inteiro".
 */
export const inteiro = (opcoes?: Parameters<typeof t.Number>[0]) => t.Number({ ...opcoes, multipleOf: 1 });

export const idParams = t.Object({ id: t.String({ minLength: 1, maxLength: 64 }) });
export const criadoResposta = t.Object({ id: t.String() });

/** Documentação da rota: tag, resumo e quem pode chamar (a mesma lista que o guard aplica). */
export const detalhe = (tag: string, papeis: readonly Papel[], resumo: string) => ({
  tags: [tag],
  summary: resumo,
  description: `Papéis permitidos: ${papeis.join(', ')}.`,
});

type ContextoCriacao = { request: Request; set: { status?: number | string; headers: Record<string, string | number | undefined> } };

/** 201 com `{ id }` e `Location` apontando para o recurso criado (o caminho da própria requisição + o id). */
export function criado({ request, set }: ContextoCriacao, { id }: { id: string }) {
  set.status = 201;
  set.headers.location = `${new URL(request.url).pathname}/${id}`;
  return { id };
}

export function semConteudo(set: { status?: number | string }): void {
  set.status = 204;
}
