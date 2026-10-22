import {
  ConflitoError,
  CredenciaisInvalidasError,
  NaoEncontradoError,
  ReferenciaInvalidaError,
} from '@application/core/erros';
import { DomainError } from '@domain/core/domain-error';
import { Elysia, ValidationError } from 'elysia';

/** Formato único de erro da API; vale também para o 401 e o 403 do guard. */
export type CorpoErro = {
  erro: {
    codigo: string;
    mensagem: string;
    detalhes?: { campo: string; mensagem: string }[];
  };
};

type Traducao = { status: number; corpo: CorpoErro };
type Logar = (erro: unknown) => void;

const STATUS_POR_ERRO: ReadonlyArray<readonly [abstract new (...args: never[]) => Error, number]> = [
  [DomainError, 422],
  [ReferenciaInvalidaError, 422],
  [NaoEncontradoError, 404],
  [ConflitoError, 409],
  [CredenciaisInvalidasError, 401],
];

const traducao = (status: number, codigo: string, mensagem: string, detalhes?: CorpoErro['erro']['detalhes']): Traducao => ({
  status,
  corpo: { erro: { codigo, mensagem, ...(detalhes && { detalhes }) } },
});

function traduzir(code: string | number, error: unknown, logar: Logar): Traducao {
  if (error instanceof ValidationError) {
    // Só campo e mensagem: `value` (o dado enviado) não volta na resposta.
    const detalhes = error.all.map((falha) => ({
      campo: `${error.type}${falha.path}`,
      mensagem: falha.summary ?? falha.message,
    }));
    return traducao(400, 'VALIDACAO', 'Dados de entrada inválidos', detalhes);
  }

  const conhecido = STATUS_POR_ERRO.find(([Classe]) => error instanceof Classe);
  if (conhecido && error instanceof Error) {
    return traducao(conhecido[1], error.name, error.message);
  }

  if (code === 'PARSE') return traducao(400, 'CORPO_INVALIDO', 'O corpo da requisição não é um JSON válido');
  if (code === 'NOT_FOUND') return traducao(404, 'ROTA_NAO_ENCONTRADA', 'Rota não encontrada');

  // Qualquer outra coisa (inclusive erro do Prisma): o detalhe vai para o log, nunca para a resposta.
  logar(error);
  return traducao(500, 'ERRO_INTERNO', 'Erro interno do servidor');
}

export const errosHttpPlugin = (logar: Logar = (erro) => console.error(erro)) =>
  new Elysia({ name: 'erros-http' }).onError({ as: 'global' }, ({ code, error, set }) => {
    const { status, corpo } = traduzir(code, error, logar);
    set.status = status;
    return corpo;
  });
