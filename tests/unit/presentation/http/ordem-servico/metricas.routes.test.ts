import { describe, expect, it } from 'bun:test';
import { criarApiFalsa } from '../support/api-falsa';

const ROTA = '/api/v1/metricas/tempo-medio-execucao';

describe('rota de métricas', () => {
  it('devolve a quantidade de OS consideradas e a média em milissegundos', async () => {
    const { requisitar, casos } = criarApiFalsa();

    const resposta = await requisitar('GET', ROTA, { papel: 'ADMINISTRADOR' });

    expect(resposta.status).toBe(200);
    expect(resposta.corpo).toEqual({ ordensConsideradas: 2, mediaMs: 3600000 });
    expect(casos.obterTempoMedioExecucao.executar).toHaveBeenCalledTimes(1);
  });

  it('sem nenhuma OS concluída a média é null, não zero', async () => {
    const { requisitar, casos } = criarApiFalsa();
    casos.obterTempoMedioExecucao.executar.mockResolvedValueOnce({ ordensConsideradas: 0, mediaMs: null });

    const resposta = await requisitar('GET', ROTA, { papel: 'ADMINISTRADOR' });

    expect(resposta.corpo).toEqual({ ordensConsideradas: 0, mediaMs: null });
  });

  it('aceita média com casas decimais', async () => {
    const { requisitar, casos } = criarApiFalsa();
    casos.obterTempoMedioExecucao.executar.mockResolvedValueOnce({ ordensConsideradas: 3, mediaMs: 1234.5 });

    const resposta = await requisitar('GET', ROTA, { papel: 'ADMINISTRADOR' });

    expect(resposta.status).toBe(200);
    expect(resposta.corpo.mediaMs).toBe(1234.5);
  });
});
