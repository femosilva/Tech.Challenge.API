import { beforeEach, describe, expect, test } from 'bun:test';
import { NaoEncontradoError } from '@application/core/erros';
import { ConsultarAndamento } from '@application/ordem-servico/acompanhamento/consultar-andamento.use-case';
import { DetalharOrdemServico } from '@application/ordem-servico/acompanhamento/detalhar-ordem-servico.use-case';
import { ListarOrdensServico } from '@application/ordem-servico/acompanhamento/listar-ordens-servico.use-case';
import { ObterTempoMedioExecucao } from '@application/ordem-servico/acompanhamento/obter-tempo-medio-execucao.use-case';
import { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import { DomainError } from '@domain/core/domain-error';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import { ClienteConsultasEmMemoria, OrdemServicoConsultasEmMemoria } from '../../doubles/consultas-em-memoria';
import { ClienteRepositorioEmMemoria, OrdemServicoRepositorioEmMemoria } from '../../doubles/repositorios-em-memoria.test';

const CPF_MARIA = '529.982.247-25';
const HORA = 60 * 60 * 1000;
const em = (minutos: number) => new Date(Date.UTC(2026, 9, 1, 8, minutos));

describe('consultas de ordem de serviço', () => {
  let clientes: ClienteRepositorioEmMemoria;
  let ordens: OrdemServicoRepositorioEmMemoria;
  let consultas: OrdemServicoConsultasEmMemoria;
  let maria: Cliente;

  /** OS com um serviço e uma peça, levada até o status pedido. */
  const novaOS = async (abertaEm: Date, ate: 'RECEBIDA' | 'AGUARDANDO_APROVACAO' | 'FINALIZADA' = 'RECEBIDA') => {
    const os = OrdemServico.abrir({ clienteId: maria.id, veiculoId: 'v1' }, abertaEm);
    if (ate !== 'RECEBIDA') {
      os.iniciarDiagnostico(abertaEm);
      os.incluirServico({ servicoId: 's1', precoUnitario: Dinheiro.deCentavos(15000) }, abertaEm);
      os.incluirPeca({ pecaId: 'p1', quantidade: Quantidade.de(2), precoUnitario: Dinheiro.deCentavos(3500) }, abertaEm);
      os.gerarOrcamento(abertaEm);
      os.enviarOrcamento(abertaEm);
    }
    if (ate === 'FINALIZADA') {
      os.aprovarOrcamento(abertaEm);
      os.finalizar(new Date(abertaEm.getTime() + HORA));
    }
    await ordens.salvar(os);
    return os;
  };

  beforeEach(async () => {
    clientes = new ClienteRepositorioEmMemoria();
    ordens = new OrdemServicoRepositorioEmMemoria();
    consultas = new OrdemServicoConsultasEmMemoria(ordens);
    maria = Cliente.cadastrar({ nome: 'Maria', documento: CPF_MARIA });
    await clientes.salvar(maria);
  });

  describe('ListarOrdensServico', () => {
    let listar: ListarOrdensServico;

    beforeEach(async () => {
      listar = new ListarOrdensServico(consultas);
      for (let i = 0; i < 25; i++) await novaOS(em(i));
    });

    test('sem paginação informada usa página 1 com 20 itens, mais recentes primeiro', async () => {
      const pagina = await listar.executar();

      expect(pagina).toMatchObject({ pagina: 1, tamanho: 20, total: 25 });
      expect(pagina.itens).toHaveLength(20);
      expect(pagina.itens[0]!.abertaEm).toEqual(em(24));
    });

    test('a segunda página traz o restante', async () => {
      const pagina = await listar.executar({ pagina: 2 });
      expect(pagina.itens).toHaveLength(5);
      expect(pagina.itens[pagina.itens.length - 1]!.abertaEm).toEqual(em(0));
    });

    test('tamanho acima do máximo fica em 100', async () => {
      expect((await listar.executar({ tamanho: 500 })).tamanho).toBe(100);
    });

    test.each([0, -1, 1.5, Number.NaN])('valor inválido %p cai no padrão', async (valor) => {
      expect(await listar.executar({ pagina: valor, tamanho: valor })).toMatchObject({ pagina: 1, tamanho: 20 });
    });

    test('cada item traz status e total', async () => {
      await novaOS(em(59), 'AGUARDANDO_APROVACAO');

      const [maisRecente] = (await listar.executar()).itens;
      expect(maisRecente).toMatchObject({ status: 'AGUARDANDO_APROVACAO', totalCentavos: 22000, clienteId: maria.id });
    });
  });

  describe('DetalharOrdemServico', () => {
    test('devolve itens, orçamento e histórico', async () => {
      const os = await novaOS(em(0), 'AGUARDANDO_APROVACAO');

      const detalhe = await new DetalharOrdemServico(consultas).executar({ id: os.id });

      expect(detalhe.itensServico).toEqual([{ servicoId: 's1', precoUnitarioCentavos: 15000 }]);
      expect(detalhe.itensPeca).toEqual([{ pecaId: 'p1', quantidade: 2, precoUnitarioCentavos: 3500 }]);
      expect(detalhe.orcamento).toEqual({ totalCentavos: 22000, enviado: true, decisao: 'PENDENTE' });
      expect(detalhe.historico.map((h) => h.status)).toEqual(['RECEBIDA', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO']);
      expect(detalhe.inicioExecucao).toBeNull();
    });

    test('OS sem orçamento traz orcamento null', async () => {
      const os = await novaOS(em(0));
      expect((await new DetalharOrdemServico(consultas).executar({ id: os.id })).orcamento).toBeNull();
    });

    test('OS inexistente vira NaoEncontradoError', async () => {
      await expect(new DetalharOrdemServico(consultas).executar({ id: 'nao-existe' })).rejects.toBeInstanceOf(
        NaoEncontradoError,
      );
    });
  });

  describe('ConsultarAndamento', () => {
    let consultar: ConsultarAndamento;

    beforeEach(() => {
      consultar = new ConsultarAndamento(consultas, new ClienteConsultasEmMemoria(clientes));
    });

    test('o cliente vê a própria OS informando o documento, com ou sem máscara', async () => {
      const os = await novaOS(em(0), 'AGUARDANDO_APROVACAO');

      expect((await consultar.executar({ id: os.id, documento: CPF_MARIA })).status).toBe('AGUARDANDO_APROVACAO');
      expect((await consultar.executar({ id: os.id, documento: '52998224725' })).id).toBe(os.id);
    });

    test('documento de outra pessoa e OS inexistente dão o mesmo NaoEncontradoError', async () => {
      const os = await novaOS(em(0));

      await expect(consultar.executar({ id: os.id, documento: '111.444.777-35' })).rejects.toThrow(
        'Ordem de serviço não encontrado',
      );
      await expect(consultar.executar({ id: 'nao-existe', documento: CPF_MARIA })).rejects.toThrow(
        'Ordem de serviço não encontrado',
      );
    });

    test('documento inválido vira DomainError', async () => {
      const os = await novaOS(em(0));
      await expect(consultar.executar({ id: os.id, documento: '123' })).rejects.toBeInstanceOf(DomainError);
    });
  });

  describe('ObterTempoMedioExecucao', () => {
    test('sem OS concluída a média é null', async () => {
      await novaOS(em(0), 'AGUARDANDO_APROVACAO');
      expect(await new ObterTempoMedioExecucao(consultas).executar()).toEqual({ ordensConsideradas: 0, mediaMs: null });
    });

    test('média das execuções concluídas; OS em andamento não entram', async () => {
      await novaOS(em(0), 'FINALIZADA'); // 1h de execução
      const longa = OrdemServico.abrir({ clienteId: maria.id, veiculoId: 'v1' }, em(10));
      longa.iniciarDiagnostico(em(10));
      longa.incluirServico({ servicoId: 's1', precoUnitario: Dinheiro.deCentavos(100) }, em(10));
      longa.gerarOrcamento(em(10));
      longa.enviarOrcamento(em(10));
      longa.aprovarOrcamento(em(10));
      longa.finalizar(new Date(em(10).getTime() + 3 * HORA)); // 3h de execução
      await ordens.salvar(longa);
      await novaOS(em(20), 'AGUARDANDO_APROVACAO');

      expect(await new ObterTempoMedioExecucao(consultas).executar()).toEqual({ ordensConsideradas: 2, mediaMs: 2 * HORA });
    });
  });
});
