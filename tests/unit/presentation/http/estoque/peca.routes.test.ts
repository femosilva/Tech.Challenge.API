import { describe, expect, it } from 'bun:test';
import { ConflitoError, NaoEncontradoError } from '@application/core/erros';
import { DomainError } from '@domain/core/domain-error';
import { criarApiFalsa, PECA } from '../support/api-falsa';

const BASE = '/api/v1/pecas';
const NOVA = { codigo: 'FO-001', nome: 'Filtro de óleo', precoCentavos: 4000, saldoInicial: 10 };
const INT_MAXIMO = 2_147_483_647;

describe('rotas de peças', () => {
  describe(`POST ${BASE}`, () => {
    it('cadastra: 201 com { id }, Location do recurso e o corpo entregue ao caso de uso', async () => {
      const { requisitar, casos } = criarApiFalsa();

      const resposta = await requisitar('POST', BASE, { papel: 'ADMINISTRADOR', corpo: NOVA });

      expect(resposta.status).toBe(201);
      expect(resposta.corpo).toEqual({ id: 'p-1' });
      expect(resposta.headers.get('location')).toBe(`${BASE}/p-1`);
      expect(casos.cadastrarPeca.executar).toHaveBeenCalledWith(NOVA);
    });

    it('o saldo inicial é opcional: sem ele, o caso de uso não recebe a chave', async () => {
      const { requisitar, casos } = criarApiFalsa();
      const { saldoInicial, ...semSaldo } = NOVA;

      const resposta = await requisitar('POST', BASE, { papel: 'ADMINISTRADOR', corpo: semSaldo });

      expect(resposta.status).toBe(201);
      expect(casos.cadastrarPeca.executar).toHaveBeenCalledWith(semSaldo);
    });

    it('corpo fora do formato: 400 VALIDACAO e o caso de uso não é chamado', async () => {
      const { requisitar, casos } = criarApiFalsa();
      const { codigo, ...semCodigo } = NOVA;
      const invalidos: [string, unknown][] = [
        ['sem código', semCodigo],
        ['código vazio', { ...NOVA, codigo: '' }],
        ['código acima de 64 caracteres', { ...NOVA, codigo: 'c'.repeat(65) }],
        ['sem nome', { codigo: 'X', precoCentavos: 1 }],
        ['sem preço', { codigo: 'X', nome: 'Y' }],
        ['preço acima do limite do banco', { ...NOVA, precoCentavos: INT_MAXIMO + 1 }],
        ['saldo inicial decimal', { ...NOVA, saldoInicial: 1.5 }],
        ['saldo inicial como texto', { ...NOVA, saldoInicial: '10' }],
        ['saldo inicial acima do limite do banco', { ...NOVA, saldoInicial: INT_MAXIMO + 1 }],
        ['campo desconhecido (saldo)', { ...NOVA, saldo: 10 }],
      ];

      for (const [descricao, corpo] of invalidos) {
        const resposta = await requisitar('POST', BASE, { papel: 'ADMINISTRADOR', corpo });
        expect([descricao, resposta.status, resposta.corpo.erro.codigo]).toEqual([descricao, 400, 'VALIDACAO']);
      }
      expect(casos.cadastrarPeca.executar).not.toHaveBeenCalled();
    });

    it('aceita os limites exatos (código com 64 caracteres, preço e saldo no teto do banco)', async () => {
      const { requisitar } = criarApiFalsa();
      const corpo = { codigo: 'c'.repeat(64), nome: 'n'.repeat(200), precoCentavos: INT_MAXIMO, saldoInicial: INT_MAXIMO };

      expect((await requisitar('POST', BASE, { papel: 'ADMINISTRADOR', corpo })).status).toBe(201);
    });

    it('código já cadastrado: 409; regra do domínio violada: 422', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.cadastrarPeca.executar.mockRejectedValueOnce(new ConflitoError('Já existe peça com este código'));
      casos.cadastrarPeca.executar.mockRejectedValueOnce(new DomainError('Dinheiro deve ser um inteiro de centavos maior ou igual a zero'));

      const duplicada = await requisitar('POST', BASE, { papel: 'ADMINISTRADOR', corpo: NOVA });
      const negativo = await requisitar('POST', BASE, { papel: 'ADMINISTRADOR', corpo: { ...NOVA, precoCentavos: -1 } });

      expect([duplicada.status, negativo.status]).toEqual([409, 422]);
    });
  });

  describe(`GET ${BASE}`, () => {
    it('lista as peças com o saldo', async () => {
      const { requisitar } = criarApiFalsa();

      const resposta = await requisitar('GET', BASE, { papel: 'MECANICO' });

      expect(resposta.status).toBe(200);
      expect(resposta.corpo).toEqual([PECA]);
    });
  });

  describe(`GET ${BASE}/:id`, () => {
    it('detalha a peça do id da URL; id inexistente é 404', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.obterPeca.executar.mockResolvedValueOnce(PECA);
      casos.obterPeca.executar.mockRejectedValueOnce(new NaoEncontradoError('Peça'));

      const existente = await requisitar('GET', `${BASE}/p-9`, { papel: 'ATENDENTE' });
      const inexistente = await requisitar('GET', `${BASE}/x`, { papel: 'ATENDENTE' });

      expect(existente.status).toBe(200);
      expect(existente.corpo).toEqual(PECA);
      expect(casos.obterPeca.executar).toHaveBeenNthCalledWith(1, { id: 'p-9' });
      expect(inexistente.status).toBe(404);
    });
  });

  describe(`PATCH ${BASE}/:id`, () => {
    it('atualiza só o que veio: 204 sem corpo, com id da URL e os campos do corpo', async () => {
      const { requisitar, casos } = criarApiFalsa();

      const nome = await requisitar('PATCH', `${BASE}/p-9`, { papel: 'ADMINISTRADOR', corpo: { nome: 'Filtro de ar' } });
      const completo = await requisitar('PATCH', `${BASE}/p-9`, {
        papel: 'ADMINISTRADOR',
        corpo: { nome: 'Filtro de ar', precoCentavos: 5000 },
      });

      expect(nome.status).toBe(204);
      expect(nome.corpo).toBeNull();
      expect(completo.status).toBe(204);
      expect(casos.atualizarPeca.executar).toHaveBeenNthCalledWith(1, { id: 'p-9', nome: 'Filtro de ar' });
      expect(casos.atualizarPeca.executar).toHaveBeenNthCalledWith(2, { id: 'p-9', nome: 'Filtro de ar', precoCentavos: 5000 });
    });

    it('código e saldo não mudam por aqui: enviá-los é 400, não um campo ignorado em silêncio', async () => {
      const { requisitar, casos } = criarApiFalsa();

      for (const corpo of [{ codigo: 'NOVO' }, { saldo: 99 }, { nome: 'Ok', saldo: 99 }, { precoCentavos: '10' }, { nome: '' }]) {
        const resposta = await requisitar('PATCH', `${BASE}/p-9`, { papel: 'ADMINISTRADOR', corpo });
        expect([resposta.status, resposta.corpo.erro.codigo]).toEqual([400, 'VALIDACAO']);
      }
      expect(casos.atualizarPeca.executar).not.toHaveBeenCalled();
    });

    it('peça inexistente: 404; regra do domínio violada: 422', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.atualizarPeca.executar.mockRejectedValueOnce(new NaoEncontradoError('Peça'));
      casos.atualizarPeca.executar.mockRejectedValueOnce(new DomainError('Nome da peça é obrigatório'));

      const inexistente = await requisitar('PATCH', `${BASE}/x`, { papel: 'ADMINISTRADOR', corpo: { nome: 'Ok' } });
      const emBranco = await requisitar('PATCH', `${BASE}/p-9`, { papel: 'ADMINISTRADOR', corpo: { nome: '   ' } });

      expect([inexistente.status, emBranco.status]).toEqual([404, 422]);
    });
  });

  describe(`DELETE ${BASE}/:id`, () => {
    it('remove: 204 sem corpo; já usada em ordens de serviço: 409; inexistente: 404', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.removerPeca.executar.mockResolvedValueOnce(undefined);
      casos.removerPeca.executar.mockRejectedValueOnce(new ConflitoError('Peça já foi utilizada em ordens de serviço'));
      casos.removerPeca.executar.mockRejectedValueOnce(new NaoEncontradoError('Peça'));

      const removida = await requisitar('DELETE', `${BASE}/p-9`, { papel: 'ADMINISTRADOR' });
      const usada = await requisitar('DELETE', `${BASE}/p-1`, { papel: 'ADMINISTRADOR' });
      const inexistente = await requisitar('DELETE', `${BASE}/x`, { papel: 'ADMINISTRADOR' });

      expect(removida.status).toBe(204);
      expect(removida.corpo).toBeNull();
      expect(casos.removerPeca.executar).toHaveBeenNthCalledWith(1, { id: 'p-9' });
      expect(usada.status).toBe(409);
      expect(inexistente.status).toBe(404);
    });
  });

  describe(`POST ${BASE}/:id/reposicoes`, () => {
    it('repõe: 204 sem corpo, com o id da URL e a quantidade do corpo', async () => {
      const { requisitar, casos } = criarApiFalsa();

      const resposta = await requisitar('POST', `${BASE}/p-9/reposicoes`, { papel: 'ADMINISTRADOR', corpo: { quantidade: 5 } });

      expect(resposta.status).toBe(204);
      expect(resposta.corpo).toBeNull();
      expect(casos.reporEstoque.executar).toHaveBeenCalledWith({ id: 'p-9', quantidade: 5 });
    });

    it('corpo fora do formato: 400 e o caso de uso não é chamado', async () => {
      const { requisitar, casos } = criarApiFalsa();
      const invalidos: [string, unknown][] = [
        ['sem quantidade', {}],
        ['quantidade decimal', { quantidade: 1.5 }],
        ['quantidade como texto', { quantidade: '5' }],
        ['quantidade acima do limite do banco', { quantidade: INT_MAXIMO + 1 }],
        ['campo desconhecido', { quantidade: 5, motivo: 'compra' }],
      ];

      for (const [descricao, corpo] of invalidos) {
        const resposta = await requisitar('POST', `${BASE}/p-9/reposicoes`, { papel: 'ADMINISTRADOR', corpo });
        expect([descricao, resposta.status, resposta.corpo.erro.codigo]).toEqual([descricao, 400, 'VALIDACAO']);
      }
      expect(casos.reporEstoque.executar).not.toHaveBeenCalled();
    });

    it('aceita a quantidade no teto do banco', async () => {
      const { requisitar } = criarApiFalsa();

      const resposta = await requisitar('POST', `${BASE}/p-9/reposicoes`, { papel: 'ADMINISTRADOR', corpo: { quantidade: INT_MAXIMO } });

      expect(resposta.status).toBe(204);
    });

    it('zero e negativo passam pelo formato e são recusados pelo domínio (422); peça inexistente: 404', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.reporEstoque.executar.mockRejectedValueOnce(new DomainError('Quantidade de reposição deve ser maior que zero'));
      casos.reporEstoque.executar.mockRejectedValueOnce(new DomainError('Quantidade deve ser um inteiro maior ou igual a zero'));
      casos.reporEstoque.executar.mockRejectedValueOnce(new NaoEncontradoError('Peça'));

      const zero = await requisitar('POST', `${BASE}/p-9/reposicoes`, { papel: 'ADMINISTRADOR', corpo: { quantidade: 0 } });
      const negativa = await requisitar('POST', `${BASE}/p-9/reposicoes`, { papel: 'ADMINISTRADOR', corpo: { quantidade: -5 } });
      const inexistente = await requisitar('POST', `${BASE}/x/reposicoes`, { papel: 'ADMINISTRADOR', corpo: { quantidade: 5 } });

      expect([zero.status, negativa.status, inexistente.status]).toEqual([422, 422, 404]);
      expect(casos.reporEstoque.executar).toHaveBeenNthCalledWith(1, { id: 'p-9', quantidade: 0 });
      expect(casos.reporEstoque.executar).toHaveBeenNthCalledWith(2, { id: 'p-9', quantidade: -5 });
    });
  });
});
