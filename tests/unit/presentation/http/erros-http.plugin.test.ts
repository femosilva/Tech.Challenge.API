import { describe, expect, it, mock, spyOn } from 'bun:test';
import {
  ConflitoError,
  CredenciaisInvalidasError,
  NaoEncontradoError,
  ReferenciaInvalidaError,
} from '@application/core/erros';
import { DomainError } from '@domain/core/domain-error';
import { type CorpoErro, errosHttpPlugin } from '@presentation/http/erros-http.plugin';
import { Elysia, t } from 'elysia';

const FALHAS: Record<string, () => Error> = {
  dominio: () => new DomainError('regra violada'),
  referencia: () => new ReferenciaInvalidaError('veículo de outro cliente'),
  naoEncontrado: () => new NaoEncontradoError('Cliente'),
  conflito: () => new ConflitoError('documento já cadastrado'),
  credenciais: () => new CredenciaisInvalidasError(),
  inesperado: () => new Error('connection to 10.0.0.5:5432 refused (senha=segredo123)'),
};

function criarApp(plugin = errosHttpPlugin(() => {})) {
  return new Elysia()
    .use(plugin)
    .get('/ok', () => ({ ok: true }))
    .post('/validar', ({ body }) => body, {
      body: t.Object({ nome: t.String({ minLength: 1 }), ano: t.Integer() }),
    })
    .get('/falha/:tipo', ({ params }) => {
      throw FALHAS[params.tipo]!();
    })
    // rotas em plugins aninhados (como um plugin de rotas que usa o guard): o tratamento de erro precisa valer nelas também
    .use(
      new Elysia()
        .get('/filha', () => {
          throw new NaoEncontradoError('Veículo');
        })
        .use(
          new Elysia().get('/neta', () => {
            throw new NaoEncontradoError('Serviço');
          }),
        ),
    );
}

const chamar = (app: ReturnType<typeof criarApp>, caminho: string, init?: RequestInit) =>
  app.handle(new Request(`http://localhost${caminho}`, init));

const json = (corpo: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
});

describe('errosHttpPlugin', () => {
  const casos = [
    { tipo: 'dominio', status: 422, codigo: 'DomainError', mensagem: 'regra violada' },
    { tipo: 'referencia', status: 422, codigo: 'ReferenciaInvalidaError', mensagem: 'veículo de outro cliente' },
    { tipo: 'naoEncontrado', status: 404, codigo: 'NaoEncontradoError', mensagem: 'Cliente não encontrado' },
    { tipo: 'conflito', status: 409, codigo: 'ConflitoError', mensagem: 'documento já cadastrado' },
    { tipo: 'credenciais', status: 401, codigo: 'CredenciaisInvalidasError', mensagem: 'Credenciais inválidas' },
  ];

  for (const { tipo, status, codigo, mensagem } of casos) {
    it(`traduz ${codigo} para ${status} no formato único de erro`, async () => {
      const resposta = await chamar(criarApp(), `/falha/${tipo}`);

      expect(resposta.status).toBe(status);
      expect(resposta.headers.get('content-type')).toContain('application/json');
      expect(await resposta.json()).toEqual({ erro: { codigo, mensagem } } satisfies CorpoErro);
    });
  }

  it('vale também para rotas definidas em plugins aninhados', async () => {
    const filha = await chamar(criarApp(), '/filha');
    const neta = await chamar(criarApp(), '/neta');

    expect(filha.status).toBe(404);
    expect(await filha.json()).toEqual({ erro: { codigo: 'NaoEncontradoError', mensagem: 'Veículo não encontrado' } });
    expect(neta.status).toBe(404);
    expect(await neta.json()).toEqual({ erro: { codigo: 'NaoEncontradoError', mensagem: 'Serviço não encontrado' } });
  });

  it('formato inválido vira 400 VALIDACAO, com campo e mensagem e sem devolver o dado enviado', async () => {
    const resposta = await chamar(criarApp(), '/validar', json({ nome: '', ano: 'abc-valor-enviado' }));
    const corpo = (await resposta.json()) as CorpoErro;

    expect(resposta.status).toBe(400);
    expect(corpo.erro.codigo).toBe('VALIDACAO');
    expect(corpo.erro.mensagem).toBe('Dados de entrada inválidos');
    expect(corpo.erro.detalhes?.map((d) => d.campo)).toEqual(expect.arrayContaining(['body/nome', 'body/ano']));
    expect(corpo.erro.detalhes?.every((d) => d.mensagem.length > 0)).toBe(true);
    expect(JSON.stringify(corpo)).not.toContain('abc-valor-enviado');
  });

  it('JSON malformado vira 400 CORPO_INVALIDO', async () => {
    const resposta = await chamar(criarApp(), '/validar', json('{ruim'));

    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toEqual({
      erro: { codigo: 'CORPO_INVALIDO', mensagem: 'O corpo da requisição não é um JSON válido' },
    });
  });

  it('rota inexistente vira 404 ROTA_NAO_ENCONTRADA', async () => {
    const resposta = await chamar(criarApp(), '/nao-existe');

    expect(resposta.status).toBe(404);
    expect(await resposta.json()).toEqual({ erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: 'Rota não encontrada' } });
  });

  it('erro inesperado vira 500 genérico: o detalhe vai para o log e não para a resposta', async () => {
    const logar = mock((_erro: unknown) => {});
    const resposta = await chamar(criarApp(errosHttpPlugin(logar)), '/falha/inesperado');
    const texto = await resposta.text();

    expect(resposta.status).toBe(500);
    expect(JSON.parse(texto)).toEqual({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor' } });
    expect(texto).not.toContain('10.0.0.5');
    expect(texto).not.toContain('segredo123');
    expect(logar).toHaveBeenCalledTimes(1);
    expect((logar.mock.calls[0]![0] as Error).message).toContain('10.0.0.5');
  });

  it('sem logger informado, o erro inesperado vai para o console.error', async () => {
    const espiao = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const resposta = await chamar(criarApp(errosHttpPlugin()), '/falha/inesperado');

      expect(resposta.status).toBe(500);
      expect(espiao).toHaveBeenCalledTimes(1);
    } finally {
      espiao.mockRestore();
    }
  });

  it('erros conhecidos e de formato não são logados como falha', async () => {
    const logar = mock((_erro: unknown) => {});
    const app = criarApp(errosHttpPlugin(logar));

    await chamar(app, '/falha/dominio');
    await chamar(app, '/validar', json({}));
    await chamar(app, '/nao-existe');

    expect(logar).not.toHaveBeenCalled();
  });

  it('não interfere nas respostas de sucesso', async () => {
    const resposta = await chamar(criarApp(), '/ok');

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ ok: true });
  });
});
