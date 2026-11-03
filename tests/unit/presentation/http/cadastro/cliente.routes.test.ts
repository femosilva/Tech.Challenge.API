import { describe, expect, it, spyOn } from 'bun:test';
import { ConflitoError, NaoEncontradoError } from '@application/core/erros';
import { DomainError } from '@domain/core/domain-error';
import { CLIENTE, criarApiFalsa, VEICULO } from '../support/api-falsa';

const BASE = '/api/v1/clientes';
const NOVO = { nome: 'Ana Souza', documento: '529.982.247-25' };

describe('rotas de clientes', () => {
  describe(`POST ${BASE}`, () => {
    it('cadastra: 201 com { id }, Location do recurso e o corpo entregue ao caso de uso', async () => {
      const { requisitar, casos } = criarApiFalsa();

      const resposta = await requisitar('POST', BASE, { papel: 'ATENDENTE', corpo: NOVO });

      expect(resposta.status).toBe(201);
      expect(resposta.corpo).toEqual({ id: 'c-1' });
      expect(resposta.headers.get('location')).toBe(`${BASE}/c-1`);
      expect(casos.cadastrarCliente.executar).toHaveBeenCalledWith(NOVO);
    });

    it('corpo fora do formato: 400 VALIDACAO e o caso de uso não é chamado', async () => {
      const { requisitar, casos } = criarApiFalsa();
      const invalidos: [string, unknown][] = [
        ['sem documento', { nome: 'Ana' }],
        ['sem nome', { documento: '529.982.247-25' }],
        ['nome vazio', { nome: '', documento: '529.982.247-25' }],
        ['nome acima de 200 caracteres', { nome: 'a'.repeat(201), documento: '529.982.247-25' }],
        ['documento acima de 32 caracteres', { nome: 'Ana', documento: '1'.repeat(33) }],
        ['nome que não é texto', { nome: 123, documento: '529.982.247-25' }],
        ['campo desconhecido', { ...NOVO, id: 'forcado' }],
      ];

      for (const [descricao, corpo] of invalidos) {
        const resposta = await requisitar('POST', BASE, { papel: 'ATENDENTE', corpo });
        expect([descricao, resposta.status, resposta.corpo.erro.codigo]).toEqual([descricao, 400, 'VALIDACAO']);
      }
      expect(casos.cadastrarCliente.executar).not.toHaveBeenCalled();
    });

    it('aceita os limites exatos de tamanho (nome com 200 e documento com 32 caracteres)', async () => {
      const { requisitar } = criarApiFalsa();
      const corpo = { nome: 'a'.repeat(200), documento: '1'.repeat(32) };

      expect((await requisitar('POST', BASE, { papel: 'ATENDENTE', corpo })).status).toBe(201);
      expect((await requisitar('PATCH', `${BASE}/c-1`, { papel: 'ATENDENTE', corpo: { nome: 'a'.repeat(200) } })).status).toBe(204);
    });

    it('JSON malformado: 400 CORPO_INVALIDO', async () => {
      const { requisitar } = criarApiFalsa();

      const resposta = await requisitar('POST', BASE, { papel: 'ATENDENTE', corpo: '{ruim' });

      expect(resposta.status).toBe(400);
      expect(resposta.corpo.erro.codigo).toBe('CORPO_INVALIDO');
    });

    it('regra de negócio violada: 422; documento já cadastrado: 409', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.cadastrarCliente.executar.mockRejectedValueOnce(new DomainError('CPF ou CNPJ inválido'));
      casos.cadastrarCliente.executar.mockRejectedValueOnce(new ConflitoError('Já existe cliente com este documento'));

      const invalido = await requisitar('POST', BASE, { papel: 'ATENDENTE', corpo: NOVO });
      const duplicado = await requisitar('POST', BASE, { papel: 'ATENDENTE', corpo: NOVO });

      expect(invalido.status).toBe(422);
      expect(invalido.corpo).toEqual({ erro: { codigo: 'DomainError', mensagem: 'CPF ou CNPJ inválido' } });
      expect(duplicado.status).toBe(409);
      expect(duplicado.corpo.erro.codigo).toBe('ConflitoError');
    });
  });

  describe(`GET ${BASE}`, () => {
    it('lista os clientes', async () => {
      const { requisitar, casos } = criarApiFalsa();

      const resposta = await requisitar('GET', BASE, { papel: 'MECANICO' });

      expect(resposta.status).toBe(200);
      expect(resposta.corpo).toEqual([CLIENTE]);
      expect(casos.listarClientes.executar).toHaveBeenCalledTimes(1);
    });
  });

  describe(`GET ${BASE}/:id`, () => {
    it('detalha o cliente do id da URL', async () => {
      const { requisitar, casos } = criarApiFalsa();

      const resposta = await requisitar('GET', `${BASE}/c-9`, { papel: 'ATENDENTE' });

      expect(resposta.status).toBe(200);
      expect(resposta.corpo).toEqual(CLIENTE);
      expect(casos.obterCliente.executar).toHaveBeenCalledWith({ id: 'c-9' });
    });

    it('id inexistente: 404', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.obterCliente.executar.mockRejectedValueOnce(new NaoEncontradoError('Cliente'));

      const resposta = await requisitar('GET', `${BASE}/nao-existe`, { papel: 'ATENDENTE' });

      expect(resposta.status).toBe(404);
      expect(resposta.corpo).toEqual({ erro: { codigo: 'NaoEncontradoError', mensagem: 'Cliente não encontrado' } });
    });

    it('resposta fora do contrato (campo a mais) é bug do servidor: 500 sem vazar o campo', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.obterCliente.executar.mockResolvedValueOnce({ ...CLIENTE, segredoInterno: 'NAO-VAZAR' } as never);
      const logar = spyOn(console, 'error').mockImplementation(() => {});

      try {
        const resposta = await requisitar('GET', `${BASE}/c-1`, { papel: 'ATENDENTE' });

        expect(resposta.status).toBe(500);
        expect(resposta.corpo).toEqual({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor' } });
        expect(JSON.stringify(resposta.corpo)).not.toContain('NAO-VAZAR');
        expect(logar).toHaveBeenCalledTimes(1);
      } finally {
        logar.mockRestore();
      }
    });
  });

  describe(`PATCH ${BASE}/:id`, () => {
    it('renomeia: 204 sem corpo, com id da URL e nome do corpo', async () => {
      const { requisitar, casos } = criarApiFalsa();

      const resposta = await requisitar('PATCH', `${BASE}/c-9`, { papel: 'ATENDENTE', corpo: { nome: 'Ana Maria' } });

      expect(resposta.status).toBe(204);
      expect(resposta.corpo).toBeNull();
      expect(casos.renomearCliente.executar).toHaveBeenCalledWith({ id: 'c-9', nome: 'Ana Maria' });
    });

    it('corpo fora do formato, incluindo documento (imutável): 400 e o caso de uso não é chamado', async () => {
      const { requisitar, casos } = criarApiFalsa();

      for (const corpo of [{}, { nome: '' }, { nome: 'Ana', documento: '529.982.247-25' }, { nome: 'a'.repeat(201) }]) {
        const resposta = await requisitar('PATCH', `${BASE}/c-9`, { papel: 'ATENDENTE', corpo });
        expect([resposta.status, resposta.corpo.erro.codigo]).toEqual([400, 'VALIDACAO']);
      }
      expect(casos.renomearCliente.executar).not.toHaveBeenCalled();
    });

    it('id inexistente: 404; nome em branco para o domínio: 422', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.renomearCliente.executar.mockRejectedValueOnce(new NaoEncontradoError('Cliente'));
      casos.renomearCliente.executar.mockRejectedValueOnce(new DomainError('Nome do cliente é obrigatório'));

      const inexistente = await requisitar('PATCH', `${BASE}/x`, { papel: 'ATENDENTE', corpo: { nome: 'Ana' } });
      const emBranco = await requisitar('PATCH', `${BASE}/c-1`, { papel: 'ATENDENTE', corpo: { nome: '   ' } });

      expect(inexistente.status).toBe(404);
      expect(emBranco.status).toBe(422);
    });
  });

  describe(`DELETE ${BASE}/:id`, () => {
    it('remove: 204 sem corpo', async () => {
      const { requisitar, casos } = criarApiFalsa();

      const resposta = await requisitar('DELETE', `${BASE}/c-9`, { papel: 'ADMINISTRADOR' });

      expect(resposta.status).toBe(204);
      expect(resposta.corpo).toBeNull();
      expect(casos.removerCliente.executar).toHaveBeenCalledWith({ id: 'c-9' });
    });

    it('com vínculo: 409; id inexistente: 404', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.removerCliente.executar.mockRejectedValueOnce(new ConflitoError('Cliente possui veículos'));
      casos.removerCliente.executar.mockRejectedValueOnce(new NaoEncontradoError('Cliente'));

      const comVinculo = await requisitar('DELETE', `${BASE}/c-1`, { papel: 'ADMINISTRADOR' });
      const inexistente = await requisitar('DELETE', `${BASE}/x`, { papel: 'ADMINISTRADOR' });

      expect(comVinculo.status).toBe(409);
      expect(comVinculo.corpo.erro.mensagem).toBe('Cliente possui veículos');
      expect(inexistente.status).toBe(404);
    });
  });

  describe(`GET ${BASE}/:id/veiculos`, () => {
    it('lista os veículos do cliente da URL', async () => {
      const { requisitar, casos } = criarApiFalsa();

      const resposta = await requisitar('GET', `${BASE}/c-9/veiculos`, { papel: 'MECANICO' });

      expect(resposta.status).toBe(200);
      expect(resposta.corpo).toEqual([VEICULO]);
      expect(casos.listarVeiculosDoCliente.executar).toHaveBeenCalledWith({ clienteId: 'c-9' });
    });

    it('cliente inexistente: 404', async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.listarVeiculosDoCliente.executar.mockRejectedValueOnce(new NaoEncontradoError('Cliente'));

      const resposta = await requisitar('GET', `${BASE}/x/veiculos`, { papel: 'MECANICO' });

      expect(resposta.status).toBe(404);
    });
  });
});
