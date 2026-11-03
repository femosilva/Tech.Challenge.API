import { describe, expect, it } from 'bun:test';
import { ConflitoError, NaoEncontradoError, ReferenciaInvalidaError } from '@application/core/erros';
import { DomainError } from '@domain/core/domain-error';
import { criarApiFalsa, VEICULO } from '../support/api-falsa';

const BASE = '/api/v1/veiculos';
const NOVO = { clienteId: 'c-1', placa: 'ABC1D23', marca: 'Volkswagen', modelo: 'Gol', ano: 2020 };

describe('rotas de veículos', () => {
  describe(`POST ${BASE}`, () => {
    it('cadastra: 201 com { id }, Location do recurso e o corpo entregue ao caso de uso', async () => {
      const { requisitar, casos } = criarApiFalsa();

      const resposta = await requisitar('POST', BASE, { papel: 'ATENDENTE', corpo: NOVO });

      expect(resposta.status).toBe(201);
      expect(resposta.corpo).toEqual({ id: 'v-1' });
      expect(resposta.headers.get('location')).toBe(`${BASE}/v-1`);
      expect(casos.cadastrarVeiculo.executar).toHaveBeenCalledWith(NOVO);
    });

    it('corpo fora do formato: 400 VALIDACAO e o caso de uso não é chamado', async () => {
      const { requisitar, casos } = criarApiFalsa();
      const { placa, ...semPlaca } = NOVO;
      const invalidos: [string, unknown][] = [
        ['sem placa', semPlaca],
        ['sem cliente', { ...NOVO, clienteId: undefined }],
        ['ano decimal', { ...NOVO, ano: 2020.5 }],
        ['ano como texto', { ...NOVO, ano: '2020' }],
        ['marca vazia', { ...NOVO, marca: '' }],
        ['modelo acima de 60 caracteres', { ...NOVO, modelo: 'm'.repeat(61) }],
        ['placa acima de 16 caracteres', { ...NOVO, placa: 'A'.repeat(17) }],
        ['campo desconhecido', { ...NOVO, cor: 'prata' }],
      ];

      for (const [descricao, corpo] of invalidos) {
        const resposta = await requisitar('POST', BASE, { papel: 'ATENDENTE', corpo });
        expect([descricao, resposta.status, resposta.corpo.erro.codigo]).toEqual([descricao, 400, 'VALIDACAO']);
      }
      expect(casos.cadastrarVeiculo.executar).not.toHaveBeenCalled();
    });

    it('aceita os limites exatos de tamanho (textos com 60, placa com 16 e clienteId com 64 caracteres)', async () => {
      const { requisitar } = criarApiFalsa();
      const corpo = { clienteId: 'c'.repeat(64), placa: 'A'.repeat(16), marca: 'm'.repeat(60), modelo: 'o'.repeat(60), ano: 2020 };

      expect((await requisitar('POST', BASE, { papel: 'ATENDENTE', corpo })).status).toBe(201);
      expect((await requisitar('PATCH', `${BASE}/v-1`, { papel: 'ATENDENTE', corpo: { marca: 'm'.repeat(60), modelo: 'o'.repeat(60) } })).status).toBe(204);
    });

    it('placa inválida: 422; cliente inexistente no corpo: 422; placa já cadastrada: 409', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.cadastrarVeiculo.executar.mockRejectedValueOnce(new DomainError('Placa inválida'));
      casos.cadastrarVeiculo.executar.mockRejectedValueOnce(new ReferenciaInvalidaError('Cliente não encontrado'));
      casos.cadastrarVeiculo.executar.mockRejectedValueOnce(new ConflitoError('Já existe veículo com esta placa'));

      const status = [];
      for (let i = 0; i < 3; i++) status.push((await requisitar('POST', BASE, { papel: 'ATENDENTE', corpo: NOVO })).status);

      expect(status).toEqual([422, 422, 409]);
    });
  });

  describe(`GET ${BASE}`, () => {
    it('lista os veículos', async () => {
      const { requisitar } = criarApiFalsa();

      const resposta = await requisitar('GET', BASE, { papel: 'MECANICO' });

      expect(resposta.status).toBe(200);
      expect(resposta.corpo).toEqual([VEICULO]);
    });
  });

  describe(`GET ${BASE}/:id`, () => {
    it('detalha o veículo do id da URL; id inexistente é 404', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.obterVeiculo.executar.mockResolvedValueOnce(VEICULO);
      casos.obterVeiculo.executar.mockRejectedValueOnce(new NaoEncontradoError('Veículo'));

      const existente = await requisitar('GET', `${BASE}/v-9`, { papel: 'ATENDENTE' });
      const inexistente = await requisitar('GET', `${BASE}/x`, { papel: 'ATENDENTE' });

      expect(existente.status).toBe(200);
      expect(existente.corpo).toEqual(VEICULO);
      expect(casos.obterVeiculo.executar).toHaveBeenNthCalledWith(1, { id: 'v-9' });
      expect(inexistente.status).toBe(404);
    });
  });

  describe(`PATCH ${BASE}/:id`, () => {
    it('atualiza só o que veio: 204 sem corpo, com id da URL e os campos do corpo', async () => {
      const { requisitar, casos } = criarApiFalsa();

      const parcial = await requisitar('PATCH', `${BASE}/v-9`, { papel: 'ATENDENTE', corpo: { marca: 'Fiat' } });
      const completo = await requisitar('PATCH', `${BASE}/v-9`, {
        papel: 'ATENDENTE',
        corpo: { marca: 'Fiat', modelo: 'Uno', ano: 2021 },
      });

      expect(parcial.status).toBe(204);
      expect(parcial.corpo).toBeNull();
      expect(completo.status).toBe(204);
      expect(casos.atualizarVeiculo.executar).toHaveBeenNthCalledWith(1, { id: 'v-9', marca: 'Fiat' });
      expect(casos.atualizarVeiculo.executar).toHaveBeenNthCalledWith(2, { id: 'v-9', marca: 'Fiat', modelo: 'Uno', ano: 2021 });
    });

    it('placa e cliente são imutáveis: enviá-los é 400, não um campo ignorado em silêncio', async () => {
      const { requisitar, casos } = criarApiFalsa();

      for (const corpo of [{ placa: 'XYZ9A99' }, { clienteId: 'c-2' }, { marca: 'Fiat', placa: 'XYZ9A99' }]) {
        const resposta = await requisitar('PATCH', `${BASE}/v-9`, { papel: 'ATENDENTE', corpo });
        expect([resposta.status, resposta.corpo.erro.codigo]).toEqual([400, 'VALIDACAO']);
        expect(resposta.corpo.erro.detalhes.some((d: { campo: string }) => /placa|clienteId/.test(d.campo))).toBe(true);
      }
      expect(casos.atualizarVeiculo.executar).not.toHaveBeenCalled();
    });

    it('tipos errados: 400; veículo inexistente: 404; ano fora do intervalo para o domínio: 422', async () => {
      const { requisitar, casos } = criarApiFalsa();

      expect((await requisitar('PATCH', `${BASE}/v-9`, { papel: 'ATENDENTE', corpo: { ano: '2020' } })).status).toBe(400);
      expect((await requisitar('PATCH', `${BASE}/v-9`, { papel: 'ATENDENTE', corpo: { marca: '' } })).status).toBe(400);

      casos.atualizarVeiculo.executar.mockRejectedValueOnce(new NaoEncontradoError('Veículo'));
      casos.atualizarVeiculo.executar.mockRejectedValueOnce(new DomainError('Ano do veículo inválido'));
      expect((await requisitar('PATCH', `${BASE}/x`, { papel: 'ATENDENTE', corpo: { ano: 2020 } })).status).toBe(404);
      expect((await requisitar('PATCH', `${BASE}/v-9`, { papel: 'ATENDENTE', corpo: { ano: 1800 } })).status).toBe(422);
    });
  });

  describe(`DELETE ${BASE}/:id`, () => {
    it('remove: 204 sem corpo; com ordens de serviço: 409; inexistente: 404', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.removerVeiculo.executar.mockResolvedValueOnce(undefined);
      casos.removerVeiculo.executar.mockRejectedValueOnce(new ConflitoError('Veículo possui ordens de serviço'));
      casos.removerVeiculo.executar.mockRejectedValueOnce(new NaoEncontradoError('Veículo'));

      const removido = await requisitar('DELETE', `${BASE}/v-9`, { papel: 'ADMINISTRADOR' });
      const comOrdens = await requisitar('DELETE', `${BASE}/v-1`, { papel: 'ADMINISTRADOR' });
      const inexistente = await requisitar('DELETE', `${BASE}/x`, { papel: 'ADMINISTRADOR' });

      expect(removido.status).toBe(204);
      expect(removido.corpo).toBeNull();
      expect(casos.removerVeiculo.executar).toHaveBeenNthCalledWith(1, { id: 'v-9' });
      expect(comOrdens.status).toBe(409);
      expect(inexistente.status).toBe(404);
    });
  });
});
