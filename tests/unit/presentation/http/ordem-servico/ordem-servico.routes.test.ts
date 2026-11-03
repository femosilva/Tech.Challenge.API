import { describe, expect, it } from 'bun:test';
import { NaoEncontradoError, ReferenciaInvalidaError } from '@application/core/erros';
import { DomainError } from '@domain/core/domain-error';
import { criarApiFalsa, INSTANTE_ISO, ORDEM_DETALHE_JSON, ORDEM_RESUMO_JSON } from '../support/api-falsa';

const BASE = '/api/v1/ordens-servico';
const INT_MAXIMO = 2_147_483_647;

describe('rotas de ordens de serviço (equipe)', () => {
  describe(`POST ${BASE}`, () => {
    const NOVA = { documento: '529.982.247-25', placa: 'ABC1D23' };

    it('abre: 201 com { id }, Location do recurso e o corpo entregue ao caso de uso', async () => {
      const { requisitar, casos } = criarApiFalsa();

      const resposta = await requisitar('POST', BASE, { papel: 'ATENDENTE', corpo: NOVA });

      expect(resposta.status).toBe(201);
      expect(resposta.corpo).toEqual({ id: 'o-1' });
      expect(resposta.headers.get('location')).toBe(`${BASE}/o-1`);
      expect(casos.abrirOS.executar).toHaveBeenCalledWith(NOVA);
    });

    it('corpo fora do formato: 400 VALIDACAO e o caso de uso não é chamado', async () => {
      const { requisitar, casos } = criarApiFalsa();
      const invalidos: [string, unknown][] = [
        ['sem documento', { placa: 'ABC1D23' }],
        ['sem placa', { documento: '529.982.247-25' }],
        ['documento vazio', { ...NOVA, documento: '' }],
        ['documento acima de 32 caracteres', { ...NOVA, documento: '1'.repeat(33) }],
        ['placa acima de 16 caracteres', { ...NOVA, placa: 'A'.repeat(17) }],
        ['placa que não é texto', { ...NOVA, placa: 1234567 }],
        ['campo desconhecido (status)', { ...NOVA, status: 'ENTREGUE' }],
      ];

      for (const [descricao, corpo] of invalidos) {
        const resposta = await requisitar('POST', BASE, { papel: 'ATENDENTE', corpo });
        expect([descricao, resposta.status, resposta.corpo.erro.codigo]).toEqual([descricao, 400, 'VALIDACAO']);
      }
      expect(casos.abrirOS.executar).not.toHaveBeenCalled();
    });

    it('aceita os limites exatos de tamanho (documento com 32 e placa com 16 caracteres)', async () => {
      const { requisitar } = criarApiFalsa();

      const resposta = await requisitar('POST', BASE, { papel: 'ATENDENTE', corpo: { documento: '1'.repeat(32), placa: 'A'.repeat(16) } });

      expect(resposta.status).toBe(201);
    });

    it('cliente ou veículo que não conferem são referência inválida no corpo: 422; documento inválido: 422', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.abrirOS.executar.mockRejectedValueOnce(new ReferenciaInvalidaError('Cliente não encontrado para o documento informado'));
      casos.abrirOS.executar.mockRejectedValueOnce(new ReferenciaInvalidaError('Veículo não pertence ao cliente'));
      casos.abrirOS.executar.mockRejectedValueOnce(new DomainError('CPF ou CNPJ inválido'));

      const status = [];
      for (let i = 0; i < 3; i++) status.push((await requisitar('POST', BASE, { papel: 'ATENDENTE', corpo: NOVA })).status);

      expect(status).toEqual([422, 422, 422]);
    });
  });

  describe(`GET ${BASE}`, () => {
    it('lista com paginação; as datas saem em ISO 8601', async () => {
      const { requisitar, casos } = criarApiFalsa();

      const resposta = await requisitar('GET', BASE, { papel: 'MECANICO' });

      expect(resposta.status).toBe(200);
      expect(resposta.corpo).toEqual({ pagina: 1, tamanho: 20, total: 1, itens: [ORDEM_RESUMO_JSON] });
      expect(resposta.corpo.itens[0].abertaEm).toBe(INSTANTE_ISO);
      expect(casos.listarOrdensServico.executar).toHaveBeenCalledWith({});
    });

    it('entrega página e tamanho ao caso de uso como números', async () => {
      const { requisitar, casos } = criarApiFalsa();

      await requisitar('GET', `${BASE}?pagina=2&tamanho=50`, { papel: 'MECANICO' });
      await requisitar('GET', `${BASE}?tamanho=500`, { papel: 'MECANICO' });

      // acima de 100 o caso de uso limita sozinho; a rota não duplica essa regra
      expect(casos.listarOrdensServico.executar).toHaveBeenNthCalledWith(1, { pagina: 2, tamanho: 50 });
      expect(casos.listarOrdensServico.executar).toHaveBeenNthCalledWith(2, { tamanho: 500 });
    });

    it('parâmetros fora do formato: 400 e o caso de uso não é chamado', async () => {
      const { requisitar, casos } = criarApiFalsa();

      for (const consulta of ['pagina=0', 'pagina=-1', 'pagina=1.5', 'pagina=abc', 'tamanho=0', 'tamanho=2.5', 'tamanho=x', 'pagina=1&foo=1']) {
        const resposta = await requisitar('GET', `${BASE}?${consulta}`, { papel: 'MECANICO' });
        expect([consulta, resposta.status, resposta.corpo.erro.codigo]).toEqual([consulta, 400, 'VALIDACAO']);
      }
      expect(casos.listarOrdensServico.executar).not.toHaveBeenCalled();
    });
  });

  describe(`GET ${BASE}/:id`, () => {
    it('detalha a OS do id da URL, com datas em ISO 8601 e campos nulos preservados', async () => {
      const { requisitar, casos } = criarApiFalsa();

      const resposta = await requisitar('GET', `${BASE}/o-9`, { papel: 'ATENDENTE' });

      expect(resposta.status).toBe(200);
      expect(resposta.corpo).toEqual(ORDEM_DETALHE_JSON);
      expect(resposta.corpo.orcamento).toBeNull();
      expect(resposta.corpo.inicioExecucao).toBeNull();
      expect(casos.detalharOrdemServico.executar).toHaveBeenCalledWith({ id: 'o-9' });
    });

    it('converte também as datas de execução e do histórico quando existem', async () => {
      const { requisitar, casos } = criarApiFalsa();
      const inicio = new Date('2026-10-02T09:30:00.000Z');
      const fim = new Date('2026-10-02T11:00:00.000Z');
      casos.detalharOrdemServico.executar.mockResolvedValueOnce({
        ...(await casos.detalharOrdemServico.executar({ id: 'x' })),
        status: 'FINALIZADA',
        orcamento: { enviado: true, decisao: 'APROVADO', totalCentavos: 23000 },
        historico: [
          { status: 'RECEBIDA', alteradoEm: inicio },
          { status: 'FINALIZADA', alteradoEm: fim },
        ],
        inicioExecucao: inicio,
        fimExecucao: fim,
      });

      const resposta = await requisitar('GET', `${BASE}/o-9`, { papel: 'ATENDENTE' });

      expect(resposta.corpo.inicioExecucao).toBe('2026-10-02T09:30:00.000Z');
      expect(resposta.corpo.fimExecucao).toBe('2026-10-02T11:00:00.000Z');
      expect(resposta.corpo.historico).toEqual([
        { status: 'RECEBIDA', alteradoEm: '2026-10-02T09:30:00.000Z' },
        { status: 'FINALIZADA', alteradoEm: '2026-10-02T11:00:00.000Z' },
      ]);
      expect(resposta.corpo.orcamento).toEqual({ enviado: true, decisao: 'APROVADO', totalCentavos: 23000 });
    });

    it('id inexistente: 404', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.detalharOrdemServico.executar.mockRejectedValueOnce(new NaoEncontradoError('Ordem de serviço'));

      const resposta = await requisitar('GET', `${BASE}/x`, { papel: 'ATENDENTE' });

      expect(resposta.status).toBe(404);
      expect(resposta.corpo.erro.mensagem).toBe('Ordem de serviço não encontrado');
    });
  });

  describe(`POST ${BASE}/:id/servicos`, () => {
    it('inclui o serviço: 204 sem corpo, com id da URL e serviço do corpo', async () => {
      const { requisitar, casos } = criarApiFalsa();

      const resposta = await requisitar('POST', `${BASE}/o-9/servicos`, { papel: 'MECANICO', corpo: { servicoId: 's-1' } });

      expect(resposta.status).toBe(204);
      expect(resposta.corpo).toBeNull();
      expect(casos.incluirServico.executar).toHaveBeenCalledWith({ id: 'o-9', servicoId: 's-1' });
    });

    it('corpo fora do formato: 400 e o caso de uso não é chamado', async () => {
      const { requisitar, casos } = criarApiFalsa();

      for (const corpo of [{}, { servicoId: '' }, { servicoId: 'a'.repeat(65) }, { servicoId: 1 }, { servicoId: 's-1', precoCentavos: 1 }]) {
        const resposta = await requisitar('POST', `${BASE}/o-9/servicos`, { papel: 'MECANICO', corpo });
        expect([resposta.status, resposta.corpo.erro.codigo]).toEqual([400, 'VALIDACAO']);
      }
      expect(casos.incluirServico.executar).not.toHaveBeenCalled();
    });

    it('OS inexistente: 404; serviço inexistente no corpo: 422; status que não permite itens: 422', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.incluirServico.executar.mockRejectedValueOnce(new NaoEncontradoError('Ordem de serviço'));
      casos.incluirServico.executar.mockRejectedValueOnce(new ReferenciaInvalidaError('Serviço informado não existe'));
      casos.incluirServico.executar.mockRejectedValueOnce(new DomainError('Status não permite alterar itens'));

      const status = [];
      for (let i = 0; i < 3; i++) status.push((await requisitar('POST', `${BASE}/o-9/servicos`, { papel: 'MECANICO', corpo: { servicoId: 's-1' } })).status);

      expect(status).toEqual([404, 422, 422]);
    });
  });

  describe(`POST ${BASE}/:id/pecas`, () => {
    it('inclui a peça: 204 sem corpo, com id da URL, peça e quantidade do corpo', async () => {
      const { requisitar, casos } = criarApiFalsa();

      const resposta = await requisitar('POST', `${BASE}/o-9/pecas`, { papel: 'ATENDENTE', corpo: { pecaId: 'p-1', quantidade: 2 } });

      expect(resposta.status).toBe(204);
      expect(resposta.corpo).toBeNull();
      expect(casos.incluirPeca.executar).toHaveBeenCalledWith({ id: 'o-9', pecaId: 'p-1', quantidade: 2 });
    });

    it('corpo fora do formato (inclusive quantidade acima do teto do banco): 400 e o caso de uso não é chamado', async () => {
      const { requisitar, casos } = criarApiFalsa();
      const invalidos: [string, unknown][] = [
        ['sem quantidade', { pecaId: 'p-1' }],
        ['sem peça', { quantidade: 1 }],
        ['quantidade decimal', { pecaId: 'p-1', quantidade: 1.5 }],
        ['quantidade como texto', { pecaId: 'p-1', quantidade: '2' }],
        ['quantidade acima do limite do banco', { pecaId: 'p-1', quantidade: INT_MAXIMO + 1 }],
        ['campo desconhecido', { pecaId: 'p-1', quantidade: 1, desconto: 5 }],
      ];

      for (const [descricao, corpo] of invalidos) {
        const resposta = await requisitar('POST', `${BASE}/o-9/pecas`, { papel: 'ATENDENTE', corpo });
        expect([descricao, resposta.status, resposta.corpo.erro.codigo]).toEqual([descricao, 400, 'VALIDACAO']);
      }
      expect(casos.incluirPeca.executar).not.toHaveBeenCalled();
    });

    it('aceita a quantidade no teto do banco; zero e negativa chegam ao domínio e voltam 422', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.incluirPeca.executar.mockResolvedValueOnce(undefined);
      casos.incluirPeca.executar.mockRejectedValueOnce(new DomainError('Quantidade deve ser maior que zero'));
      casos.incluirPeca.executar.mockRejectedValueOnce(new DomainError('Quantidade deve ser um inteiro maior ou igual a zero'));

      const noTeto = await requisitar('POST', `${BASE}/o-9/pecas`, { papel: 'ATENDENTE', corpo: { pecaId: 'p-1', quantidade: INT_MAXIMO } });
      const zero = await requisitar('POST', `${BASE}/o-9/pecas`, { papel: 'ATENDENTE', corpo: { pecaId: 'p-1', quantidade: 0 } });
      const negativa = await requisitar('POST', `${BASE}/o-9/pecas`, { papel: 'ATENDENTE', corpo: { pecaId: 'p-1', quantidade: -3 } });

      expect([noTeto.status, zero.status, negativa.status]).toEqual([204, 422, 422]);
      expect(casos.incluirPeca.executar).toHaveBeenNthCalledWith(3, { id: 'o-9', pecaId: 'p-1', quantidade: -3 });
    });
  });

  describe('transições de status (um comando por rota)', () => {
    const transicoes = [
      { rota: 'iniciar-diagnostico', caso: 'iniciarDiagnostico', papel: 'MECANICO' },
      { rota: 'enviar-orcamento', caso: 'enviarOrcamento', papel: 'ATENDENTE' },
      { rota: 'finalizar', caso: 'finalizarServico', papel: 'MECANICO' },
      { rota: 'entregar', caso: 'entregarVeiculo', papel: 'ATENDENTE' },
    ] as const;

    for (const { rota, caso, papel } of transicoes) {
      it(`POST ${BASE}/:id/${rota}: 204 sem corpo e o id da URL entregue ao caso de uso`, async () => {
        const { requisitar, casos } = criarApiFalsa();

        const resposta = await requisitar('POST', `${BASE}/o-9/${rota}`, { papel });

        expect(resposta.status).toBe(204);
        expect(resposta.corpo).toBeNull();
        expect(casos[caso].executar).toHaveBeenCalledWith({ id: 'o-9' });
      });

      it(`POST ${BASE}/:id/${rota}: OS inexistente é 404 e transição não permitida é 422`, async () => {
        const { requisitar, casos } = criarApiFalsa();
        casos[caso].executar.mockRejectedValueOnce(new NaoEncontradoError('Ordem de serviço'));
        casos[caso].executar.mockRejectedValueOnce(new DomainError('Transição de status não permitida'));

        const inexistente = await requisitar('POST', `${BASE}/x/${rota}`, { papel });
        const invalida = await requisitar('POST', `${BASE}/o-9/${rota}`, { papel });

        expect([inexistente.status, invalida.status]).toEqual([404, 422]);
        expect(invalida.corpo.erro.mensagem).toBe('Transição de status não permitida');
      });
    }
  });
});
