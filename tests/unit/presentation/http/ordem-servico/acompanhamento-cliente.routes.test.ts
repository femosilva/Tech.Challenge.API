import { describe, expect, it } from 'bun:test';
import { NaoEncontradoError } from '@application/core/erros';
import { DomainError } from '@domain/core/domain-error';
import { criarApiFalsa, ORDEM_DETALHE_JSON } from '../support/api-falsa';

const BASE = '/api/v1/cliente/ordens-servico';
const DOC = '529.982.247-25';

/** Sem papel: estas rotas são públicas. O documento vai no cabeçalho X-Documento. */
const chamar = (api: ReturnType<typeof criarApiFalsa>, metodo: string, caminho: string, documento?: string) =>
  api.app.handle(
    new Request(`http://localhost${caminho}`, { method: metodo, headers: documento === undefined ? {} : { 'x-documento': documento } }),
  );
const lerCorpo = async (resposta: Response) => {
  const texto = await resposta.text();
  return texto ? JSON.parse(texto) : null;
};

describe('rotas do cliente (sem login)', () => {
  describe(`GET ${BASE}/:id`, () => {
    it('devolve o andamento sem token, entregando OS e documento ao caso de uso', async () => {
      const api = criarApiFalsa();

      const resposta = await chamar(api, 'GET', `${BASE}/o-9`, DOC);

      expect(resposta.status).toBe(200);
      expect(await lerCorpo(resposta)).toEqual(ORDEM_DETALHE_JSON);
      expect(api.casos.consultarAndamento.executar).toHaveBeenCalledWith({ id: 'o-9', documento: DOC });
    });

    it('não exige JWT e ignora um token qualquer: o guard não está nestas rotas', async () => {
      const api = criarApiFalsa();

      const semToken = await chamar(api, 'GET', `${BASE}/o-9`, DOC);
      const comLixo = await api.app.handle(
        new Request(`http://localhost${BASE}/o-9`, { headers: { 'x-documento': DOC, authorization: 'Bearer lixo' } }),
      );

      expect([semToken.status, comLixo.status]).toEqual([200, 200]);
    });

    it('sem o cabeçalho, vazio ou longo demais: 400 e o caso de uso não é chamado', async () => {
      const api = criarApiFalsa();

      for (const documento of [undefined, '', '1'.repeat(33)]) {
        const resposta = await chamar(api, 'GET', `${BASE}/o-9`, documento);
        expect([documento, resposta.status, (await lerCorpo(resposta)).erro.codigo]).toEqual([documento, 400, 'VALIDACAO']);
      }
      expect(api.casos.consultarAndamento.executar).not.toHaveBeenCalled();
    });

    it('OS inexistente e documento que não confere devolvem exatamente a mesma resposta 404', async () => {
      const api = criarApiFalsa();
      api.casos.consultarAndamento.executar.mockRejectedValue(new NaoEncontradoError('Ordem de serviço'));

      const inexistente = await chamar(api, 'GET', `${BASE}/nao-existe`, DOC);
      const outroDocumento = await chamar(api, 'GET', `${BASE}/o-9`, '111.444.777-35');

      expect([inexistente.status, outroDocumento.status]).toEqual([404, 404]);
      expect(await lerCorpo(inexistente)).toEqual(await lerCorpo(outroDocumento));
    });

    it('documento malformado é regra do domínio: 422', async () => {
      const api = criarApiFalsa();
      api.casos.consultarAndamento.executar.mockRejectedValueOnce(new DomainError('CPF ou CNPJ inválido'));

      const resposta = await chamar(api, 'GET', `${BASE}/o-9`, '123');

      expect(resposta.status).toBe(422);
    });
  });

  const decisoes = [
    { rota: 'aprovar', caso: 'aprovarOrcamento' },
    { rota: 'rejeitar', caso: 'rejeitarOrcamento' },
  ] as const;

  for (const { rota, caso } of decisoes) {
    describe(`POST ${BASE}/:id/orcamento/${rota}`, () => {
      it('204 sem corpo, sem token, com OS e documento entregues ao caso de uso', async () => {
        const api = criarApiFalsa();

        const resposta = await chamar(api, 'POST', `${BASE}/o-9/orcamento/${rota}`, DOC);

        expect(resposta.status).toBe(204);
        expect(await lerCorpo(resposta)).toBeNull();
        expect(api.casos[caso].executar).toHaveBeenCalledWith({ id: 'o-9', documento: DOC });
      });

      it('sem o cabeçalho X-Documento: 400 e o caso de uso não é chamado', async () => {
        const api = criarApiFalsa();

        const resposta = await chamar(api, 'POST', `${BASE}/o-9/orcamento/${rota}`);

        expect(resposta.status).toBe(400);
        expect(api.casos[caso].executar).not.toHaveBeenCalled();
      });

      it('OS inexistente ou documento errado: 404; status que não permite decidir: 422', async () => {
        const api = criarApiFalsa();
        api.casos[caso].executar.mockRejectedValueOnce(new NaoEncontradoError('Ordem de serviço'));
        api.casos[caso].executar.mockRejectedValueOnce(new DomainError('Transição de status não permitida'));

        const inexistente = await chamar(api, 'POST', `${BASE}/x/orcamento/${rota}`, DOC);
        const invalida = await chamar(api, 'POST', `${BASE}/o-9/orcamento/${rota}`, DOC);

        expect([inexistente.status, invalida.status]).toEqual([404, 422]);
      });
    });
  }
});
