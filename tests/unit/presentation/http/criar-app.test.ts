import { describe, expect, it } from 'bun:test';
import type { CorpoErro } from '@presentation/http/erros-http.plugin';
import { criarApp } from '@presentation/http/criar-app';

const chamar = (caminho: string) => criarApp().handle(new Request(`http://localhost${caminho}`));

describe('criarApp', () => {
  it('GET /health responde 200 com status ok, sem depender de banco', async () => {
    const resposta = await chamar('/health');

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ status: 'ok' });
  });

  it('publica o spec OpenAPI em /openapi/json com o health documentado', async () => {
    const resposta = await chamar('/openapi/json');
    const spec = (await resposta.json()) as {
      openapi: string;
      info: { title: string; version: string };
      paths: Record<string, unknown>;
    };

    expect(resposta.status).toBe(200);
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info).toMatchObject({ title: 'API da Oficina Mecânica', version: '1.0.0' });
    expect(Object.keys(spec.paths)).toEqual(['/health']);
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
});
