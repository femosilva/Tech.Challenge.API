import type { Papel } from '@domain/value-objects/papel.vo';
import type { ConfigGuardJwt } from '@presentation/http/auth.guard';
import { SignJWT } from 'jose';

export type Resposta<T = any> = { status: number; headers: Headers; corpo: T };
export type Opcoes = { papel?: Papel; corpo?: unknown; cabecalhos?: Record<string, string> };
export type Requisitar = <T = any>(metodo: string, caminho: string, opcoes?: Opcoes) => Promise<Resposta<T>>;

/** Chama a API em memória (sem abrir porta). Com `papel`, envia um token assinado como o login faria. */
export function criarRequisitor(app: { handle: (request: Request) => Promise<Response> }, jwt: ConfigGuardJwt): Requisitar {
  const chave = new TextEncoder().encode(jwt.segredo);
  const token = (papel: Papel) =>
    new SignJWT({ papel })
      .setProtectedHeader({ alg: jwt.algoritmo })
      .setSubject(`usuario-${papel}`)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(chave);

  return async (metodo, caminho, { papel, corpo, cabecalhos } = {}) => {
    const headers: Record<string, string> = { ...cabecalhos };
    if (papel) headers.authorization = `Bearer ${await token(papel)}`;
    if (corpo !== undefined) headers['content-type'] = 'application/json';
    const resposta = await app.handle(
      new Request(`http://localhost${caminho}`, {
        method: metodo,
        headers,
        body: corpo === undefined ? undefined : typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
      }),
    );
    const texto = await resposta.text();
    return { status: resposta.status, headers: resposta.headers, corpo: texto ? JSON.parse(texto) : null };
  };
}
