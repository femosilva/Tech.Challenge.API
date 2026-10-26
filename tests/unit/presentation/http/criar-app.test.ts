import { describe, expect, it, mock } from 'bun:test';
import { CredenciaisInvalidasError } from '@application/core/erros';
import { criarApp } from '@presentation/http/criar-app';
import type { CorpoErro } from '@presentation/http/erros-http.plugin';

const autenticar = mock(async (_input: { email: string; senha: string }) => ({ token: 'token-de-teste' }));
const criar = () => criarApp({ autenticar: { executar: autenticar } });

const chamar = (caminho: string, init?: RequestInit) => criar().handle(new Request(`http://localhost${caminho}`, init));
const postarJson = (caminho: string, corpo: unknown) =>
  chamar(caminho, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });

describe('criarApp', () => {
  it('GET /health responde 200 com status ok, sem depender de banco', async () => {
    const resposta = await chamar('/health');

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ status: 'ok' });
  });

  it('publica o spec OpenAPI em /openapi/json com health e login documentados', async () => {
    const resposta = await chamar('/openapi/json');
    const spec = (await resposta.json()) as {
      openapi: string;
      info: { title: string; version: string };
      paths: Record<string, { post?: { tags: string[]; responses: Record<string, unknown> } }>;
    };

    expect(resposta.status).toBe(200);
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info).toMatchObject({ title: 'API da Oficina Mecânica', version: '1.0.0' });
    expect(Object.keys(spec.paths).sort()).toEqual(['/api/v1/auth/login', '/health']);

    const login = spec.paths['/api/v1/auth/login']!.post!;
    expect(login.tags).toEqual(['Autenticação']);
    expect(Object.keys(login.responses).sort()).toEqual(['200', '400', '401']);
  });

  it('serve a interface da documentação em /openapi', async () => {
    const resposta = await chamar('/openapi');

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('content-type')).toContain('text/html');
    expect(await resposta.text()).toContain('scalar');
  });

  it('rota inexistente usa o formato único de erro', async () => {
    const resposta = await chamar('/nao-existe');

    expect(resposta.status).toBe(404);
    expect((await resposta.json()) as CorpoErro).toEqual({
      erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: 'Rota não encontrada' },
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('entrega e-mail e senha ao caso de uso e devolve o token', async () => {
      autenticar.mockClear();

      const resposta = await postarJson('/api/v1/auth/login', { email: 'admin@oficina.local', senha: 'admin123' });

      expect(resposta.status).toBe(200);
      expect(await resposta.json()).toEqual({ token: 'token-de-teste' });
      expect(autenticar).toHaveBeenCalledTimes(1);
      expect(autenticar).toHaveBeenCalledWith({ email: 'admin@oficina.local', senha: 'admin123' });
    });

    it('aceita os limites exatos de tamanho (e-mail com 254 e senha com 128 caracteres)', async () => {
      const resposta = await postarJson('/api/v1/auth/login', { email: `${'a'.repeat(250)}@b.c`, senha: 'x'.repeat(128) });

      expect(resposta.status).toBe(200);
    });

    it('só existe sob o prefixo /api/v1', async () => {
      const resposta = await postarJson('/auth/login', { email: 'a@b.c', senha: 'x' });

      expect(resposta.status).toBe(404);
    });

    it('credenciais inválidas viram 401 no formato único, sem revelar o que falhou', async () => {
      autenticar.mockRejectedValueOnce(new CredenciaisInvalidasError());

      const resposta = await postarJson('/api/v1/auth/login', { email: 'x@oficina.local', senha: 'errada' });

      expect(resposta.status).toBe(401);
      expect((await resposta.json()) as CorpoErro).toEqual({
        erro: { codigo: 'CredenciaisInvalidasError', mensagem: 'Credenciais inválidas' },
      });
    });

    it('corpo fora do formato vira 400 e o caso de uso nem é chamado', async () => {
      autenticar.mockClear();
      const invalidos = [
        {},
        { email: 'a@b.c' },
        { senha: 'x' },
        { email: '', senha: 'x' },
        { email: 'a@b.c', senha: '' },
        { email: 123, senha: 'x' },
        { email: 'a@b.c', senha: 'x'.repeat(129) },
        { email: `${'a'.repeat(251)}@b.c`, senha: 'x' },
      ];

      for (const corpo of invalidos) {
        const resposta = await postarJson('/api/v1/auth/login', corpo);
        expect(resposta.status).toBe(400);
        expect(((await resposta.json()) as CorpoErro).erro.codigo).toBe('VALIDACAO');
      }
      expect(autenticar).not.toHaveBeenCalled();
    });
  });
});
