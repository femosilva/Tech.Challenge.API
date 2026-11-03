import { describe, expect, it } from 'bun:test';
import { ConflitoError, NaoEncontradoError } from '@application/core/erros';
import { DomainError } from '@domain/core/domain-error';
import { criarApiFalsa, SERVICO } from '../support/api-falsa';

const BASE = '/api/v1/servicos';
const NOVO = { nome: 'Troca de óleo', precoCentavos: 15000 };
const INT_MAXIMO = 2_147_483_647;

describe('rotas de serviços', () => {
  describe(`POST ${BASE}`, () => {
    it('cadastra: 201 com { id }, Location do recurso e o corpo entregue ao caso de uso', async () => {
      const { requisitar, casos } = criarApiFalsa();

      const resposta = await requisitar('POST', BASE, { papel: 'ADMINISTRADOR', corpo: NOVO });

      expect(resposta.status).toBe(201);
      expect(resposta.corpo).toEqual({ id: 's-1' });
      expect(resposta.headers.get('location')).toBe(`${BASE}/s-1`);
      expect(casos.cadastrarServico.executar).toHaveBeenCalledWith(NOVO);
    });

    it('corpo fora do formato: 400 VALIDACAO e o caso de uso não é chamado', async () => {
      const { requisitar, casos } = criarApiFalsa();
      const invalidos: [string, unknown][] = [
        ['sem nome', { precoCentavos: 15000 }],
        ['sem preço', { nome: 'Troca de óleo' }],
        ['nome vazio', { nome: '', precoCentavos: 15000 }],
        ['nome acima de 200 caracteres', { nome: 'a'.repeat(201), precoCentavos: 15000 }],
        ['preço decimal', { ...NOVO, precoCentavos: 150.5 }],
        ['preço como texto', { ...NOVO, precoCentavos: '15000' }],
        ['preço acima do limite do banco', { ...NOVO, precoCentavos: INT_MAXIMO + 1 }],
        ['campo desconhecido', { ...NOVO, desconto: 10 }],
      ];

      for (const [descricao, corpo] of invalidos) {
        const resposta = await requisitar('POST', BASE, { papel: 'ADMINISTRADOR', corpo });
        expect([descricao, resposta.status, resposta.corpo.erro.codigo]).toEqual([descricao, 400, 'VALIDACAO']);
      }
      expect(casos.cadastrarServico.executar).not.toHaveBeenCalled();
    });

    it('aceita os limites exatos (nome com 200 caracteres e preço no teto do banco)', async () => {
      const { requisitar } = criarApiFalsa();
      const corpo = { nome: 'a'.repeat(200), precoCentavos: INT_MAXIMO };

      expect((await requisitar('POST', BASE, { papel: 'ADMINISTRADOR', corpo })).status).toBe(201);
      expect((await requisitar('PATCH', `${BASE}/s-1`, { papel: 'ADMINISTRADOR', corpo })).status).toBe(204);
    });

    it('o sinal do preço é regra do domínio: negativo e zero chegam ao caso de uso e voltam 422', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.cadastrarServico.executar.mockRejectedValueOnce(new DomainError('Dinheiro deve ser um inteiro de centavos maior ou igual a zero'));
      casos.cadastrarServico.executar.mockRejectedValueOnce(new DomainError('Preço do serviço deve ser maior que zero'));

      const negativo = await requisitar('POST', BASE, { papel: 'ADMINISTRADOR', corpo: { ...NOVO, precoCentavos: -1 } });
      const zero = await requisitar('POST', BASE, { papel: 'ADMINISTRADOR', corpo: { ...NOVO, precoCentavos: 0 } });

      expect([negativo.status, zero.status]).toEqual([422, 422]);
      expect(casos.cadastrarServico.executar).toHaveBeenNthCalledWith(1, { ...NOVO, precoCentavos: -1 });
      expect(casos.cadastrarServico.executar).toHaveBeenNthCalledWith(2, { ...NOVO, precoCentavos: 0 });
    });
  });

  describe(`GET ${BASE}`, () => {
    it('lista os serviços', async () => {
      const { requisitar } = criarApiFalsa();

      const resposta = await requisitar('GET', BASE, { papel: 'MECANICO' });

      expect(resposta.status).toBe(200);
      expect(resposta.corpo).toEqual([SERVICO]);
    });
  });

  describe(`GET ${BASE}/:id`, () => {
    it('detalha o serviço do id da URL; id inexistente é 404', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.obterServico.executar.mockResolvedValueOnce(SERVICO);
      casos.obterServico.executar.mockRejectedValueOnce(new NaoEncontradoError('Serviço'));

      const existente = await requisitar('GET', `${BASE}/s-9`, { papel: 'ATENDENTE' });
      const inexistente = await requisitar('GET', `${BASE}/x`, { papel: 'ATENDENTE' });

      expect(existente.status).toBe(200);
      expect(existente.corpo).toEqual(SERVICO);
      expect(casos.obterServico.executar).toHaveBeenNthCalledWith(1, { id: 's-9' });
      expect(inexistente.status).toBe(404);
      expect(inexistente.corpo.erro.mensagem).toBe('Serviço não encontrado');
    });
  });

  describe(`PATCH ${BASE}/:id`, () => {
    it('atualiza só o que veio: 204 sem corpo, com id da URL e os campos do corpo', async () => {
      const { requisitar, casos } = criarApiFalsa();

      const preco = await requisitar('PATCH', `${BASE}/s-9`, { papel: 'ADMINISTRADOR', corpo: { precoCentavos: 20000 } });
      const completo = await requisitar('PATCH', `${BASE}/s-9`, {
        papel: 'ADMINISTRADOR',
        corpo: { nome: 'Alinhamento', precoCentavos: 9000 },
      });

      expect(preco.status).toBe(204);
      expect(preco.corpo).toBeNull();
      expect(completo.status).toBe(204);
      expect(casos.atualizarServico.executar).toHaveBeenNthCalledWith(1, { id: 's-9', precoCentavos: 20000 });
      expect(casos.atualizarServico.executar).toHaveBeenNthCalledWith(2, { id: 's-9', nome: 'Alinhamento', precoCentavos: 9000 });
    });

    it('tipos errados, campo desconhecido (inclusive id): 400 e o caso de uso não é chamado', async () => {
      const { requisitar, casos } = criarApiFalsa();

      for (const corpo of [{ precoCentavos: '9000' }, { precoCentavos: 90.5 }, { precoCentavos: INT_MAXIMO + 1 }, { nome: '' }, { id: 'outro' }]) {
        const resposta = await requisitar('PATCH', `${BASE}/s-9`, { papel: 'ADMINISTRADOR', corpo });
        expect([resposta.status, resposta.corpo.erro.codigo]).toEqual([400, 'VALIDACAO']);
      }
      expect(casos.atualizarServico.executar).not.toHaveBeenCalled();
    });

    it('serviço inexistente: 404; regra do domínio violada: 422', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.atualizarServico.executar.mockRejectedValueOnce(new NaoEncontradoError('Serviço'));
      casos.atualizarServico.executar.mockRejectedValueOnce(new DomainError('Preço do serviço deve ser maior que zero'));

      const inexistente = await requisitar('PATCH', `${BASE}/x`, { papel: 'ADMINISTRADOR', corpo: { nome: 'Ok' } });
      const preco = await requisitar('PATCH', `${BASE}/s-9`, { papel: 'ADMINISTRADOR', corpo: { precoCentavos: 0 } });

      expect([inexistente.status, preco.status]).toEqual([404, 422]);
    });
  });

  describe(`DELETE ${BASE}/:id`, () => {
    it('remove: 204 sem corpo; já usado em ordens de serviço: 409; inexistente: 404', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.removerServico.executar.mockResolvedValueOnce(undefined);
      casos.removerServico.executar.mockRejectedValueOnce(new ConflitoError('Serviço já foi utilizado em ordens de serviço'));
      casos.removerServico.executar.mockRejectedValueOnce(new NaoEncontradoError('Serviço'));

      const removido = await requisitar('DELETE', `${BASE}/s-9`, { papel: 'ADMINISTRADOR' });
      const usado = await requisitar('DELETE', `${BASE}/s-1`, { papel: 'ADMINISTRADOR' });
      const inexistente = await requisitar('DELETE', `${BASE}/x`, { papel: 'ADMINISTRADOR' });

      expect(removido.status).toBe(204);
      expect(removido.corpo).toBeNull();
      expect(casos.removerServico.executar).toHaveBeenNthCalledWith(1, { id: 's-9' });
      expect(usado.status).toBe(409);
      expect(inexistente.status).toBe(404);
    });
  });
});
