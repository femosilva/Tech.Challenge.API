import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import { Servico } from '@domain/catalogo/servico.aggregate';
import { Peca } from '@domain/estoque/peca.aggregate';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import { VeiculoRepositoryAdapter } from '@infrastructure/persistence/cadastro/veiculo/veiculo-repository.adapter';
import { ServicoRepositoryAdapter } from '@infrastructure/persistence/catalogo/servico-repository.adapter';
import { PecaRepositoryAdapter } from '@infrastructure/persistence/estoque/peca-repository.adapter';
import { OrdemServicoConsultasAdapter } from '@infrastructure/persistence/ordem-servico/ordem-servico-consultas.adapter';
import { OrdemServicoRepositoryAdapter } from '@infrastructure/persistence/ordem-servico/ordem-servico-repository.adapter';
import { limparBanco, prisma } from '../../support/banco-de-teste';
import { prepararCenario } from '../../support/cenario-ordem-servico';
import { CPF_BIA, salvarCliente } from '../../support/dados-de-teste';

const repo = new OrdemServicoRepositoryAdapter(prisma);
const consultas = new OrdemServicoConsultasAdapter(prisma);
const em = (minutos: number) => new Date(Date.UTC(2026, 0, 10, 10, minutos));
const preco = (centavos: number) => Dinheiro.deCentavos(centavos);
const MINUTO = 60_000;

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

type Cenario = Awaited<ReturnType<typeof prepararCenario>>;

const abrirOs = async ({ cliente, veiculo }: Cenario, abertaEm: number) => {
  const os = OrdemServico.abrir({ clienteId: cliente.id, veiculoId: veiculo.id }, em(abertaEm));
  await repo.salvar(os);
  return os;
};

/** OS que já passou pela execução: começou em `inicio` e terminou em `fim` (minutos). */
const osFinalizada = async (cenario: Cenario, inicio: number, fim: number) => {
  const os = OrdemServico.abrir({ clienteId: cenario.cliente.id, veiculoId: cenario.veiculo.id }, em(0));
  os.iniciarDiagnostico(em(1));
  os.incluirServico({ servicoId: cenario.servico.id, precoUnitario: preco(15000) }, em(2));
  os.gerarOrcamento(em(3));
  os.enviarOrcamento(em(4));
  os.aprovarOrcamento(em(inicio));
  os.finalizar(em(fim));
  await repo.salvar(os);
  return os;
};

describe('OrdemServicoConsultasAdapter.listar', () => {
  it('mais recentes primeiro, paginando sem repetir nem pular', async () => {
    const cenario = await prepararCenario();
    const antiga = await abrirOs(cenario, 0);
    const meio = await abrirOs(cenario, 10);
    const recente = await abrirOs(cenario, 20);

    const primeira = await consultas.listar({ pagina: 1, tamanho: 2 });
    const segunda = await consultas.listar({ pagina: 2, tamanho: 2 });
    const alemDoFim = await consultas.listar({ pagina: 3, tamanho: 2 });

    expect(primeira).toMatchObject({ pagina: 1, tamanho: 2, total: 3 });
    expect(primeira.itens.map((o) => o.id)).toEqual([recente.id, meio.id]);
    expect(segunda.itens.map((o) => o.id)).toEqual([antiga.id]);
    expect(segunda.total).toBe(3);
    expect(alemDoFim.itens).toEqual([]);
  });

  it('cada item traz status, data de abertura e o total recalculado dos itens', async () => {
    const cenario = await prepararCenario();
    const os = OrdemServico.abrir({ clienteId: cenario.cliente.id, veiculoId: cenario.veiculo.id }, em(5));
    os.iniciarDiagnostico(em(6));
    os.incluirServico({ servicoId: cenario.servico.id, precoUnitario: preco(15000) }, em(7));
    os.incluirPeca({ pecaId: cenario.peca.id, quantidade: Quantidade.de(2), precoUnitario: preco(4000) }, em(7));
    await repo.salvar(os);

    const { itens } = await consultas.listar({ pagina: 1, tamanho: 10 });

    expect(itens).toEqual([
      {
        id: os.id,
        clienteId: cenario.cliente.id,
        veiculoId: cenario.veiculo.id,
        status: 'EM_DIAGNOSTICO',
        totalCentavos: 23000,
        abertaEm: em(5),
      },
    ]);
    expect(itens[0]!.totalCentavos).toBe(os.total.centavos);
  });

  it('OS abertas no mesmo instante saem sempre na mesma ordem (desempate por id)', async () => {
    const cenario = await prepararCenario();
    const ids: string[] = [];
    // com 6 OS, a chance de a ordem de inserção coincidir com a ordem dos ids é de 1 em 720
    for (let i = 0; i < 6; i++) ids.push((await abrirOs(cenario, 0)).id);

    const { itens } = await consultas.listar({ pagina: 1, tamanho: 10 });

    expect(itens.map((o) => o.id)).toEqual(ids.sort());
  });

  it('sem OS devolve página vazia', async () => {
    expect(await consultas.listar({ pagina: 1, tamanho: 20 })).toEqual({ pagina: 1, tamanho: 20, total: 0, itens: [] });
  });
});

describe('OrdemServicoConsultasAdapter.detalhar', () => {
  it('devolve itens, orçamento, histórico e execução da OS', async () => {
    const cenario = await prepararCenario();
    const os = OrdemServico.abrir({ clienteId: cenario.cliente.id, veiculoId: cenario.veiculo.id }, em(0));
    os.iniciarDiagnostico(em(1));
    os.incluirServico({ servicoId: cenario.servico.id, precoUnitario: preco(15000) }, em(2));
    os.incluirPeca({ pecaId: cenario.peca.id, quantidade: Quantidade.de(2), precoUnitario: preco(4000) }, em(3));
    os.gerarOrcamento(em(4));
    os.enviarOrcamento(em(5));
    os.aprovarOrcamento(em(6));
    os.finalizar(em(30));
    await repo.salvar(os);

    expect(await consultas.detalhar({ id: os.id })).toEqual({
      id: os.id,
      clienteId: cenario.cliente.id,
      veiculoId: cenario.veiculo.id,
      status: 'FINALIZADA',
      totalCentavos: 23000,
      abertaEm: em(0),
      itensServico: [{ servicoId: cenario.servico.id, precoUnitarioCentavos: 15000 }],
      itensPeca: [{ pecaId: cenario.peca.id, quantidade: 2, precoUnitarioCentavos: 4000 }],
      orcamento: { totalCentavos: 23000, enviado: true, decisao: 'APROVADO' },
      historico: [
        { status: 'RECEBIDA', alteradoEm: em(0) },
        { status: 'EM_DIAGNOSTICO', alteradoEm: em(1) },
        { status: 'AGUARDANDO_APROVACAO', alteradoEm: em(5) },
        { status: 'EM_EXECUCAO', alteradoEm: em(6) },
        { status: 'FINALIZADA', alteradoEm: em(30) },
      ],
      inicioExecucao: em(6),
      fimExecucao: em(30),
    });
  });

  it('OS recém aberta vem sem orçamento nem datas de execução; inexistente devolve null', async () => {
    const os = await abrirOs(await prepararCenario(), 0);

    expect(await consultas.detalhar({ id: os.id })).toMatchObject({
      status: 'RECEBIDA',
      totalCentavos: 0,
      orcamento: null,
      inicioExecucao: null,
      fimExecucao: null,
      itensServico: [],
      itensPeca: [],
    });
    expect(await consultas.detalhar({ id: 'inexistente' })).toBeNull();
  });
});

describe('OrdemServicoConsultasAdapter.tempoMedioExecucao', () => {
  it('sem OS concluída a média é null', async () => {
    await abrirOs(await prepararCenario(), 0);

    expect(await consultas.tempoMedioExecucao()).toEqual({ ordensConsideradas: 0, mediaMs: null });
  });

  it('média no banco só das execuções concluídas; OS em andamento não entram', async () => {
    const cenario = await prepararCenario();
    await osFinalizada(cenario, 10, 34); // 24 min
    await osFinalizada(cenario, 10, 46); // 36 min
    const emExecucao = await osFinalizada(cenario, 10, 20);
    await prisma.ordemServico.update({ where: { id: emExecucao.id }, data: { fimExecucao: null, status: 'EM_EXECUCAO' } });
    await abrirOs(cenario, 0);

    expect(await consultas.tempoMedioExecucao()).toEqual({ ordensConsideradas: 2, mediaMs: 30 * MINUTO });
  });
});

describe('OrdemServicoConsultasAdapter.existePor*', () => {
  it('encontra o que a OS referencia e nega o que ela não referencia', async () => {
    const cenario = await prepararCenario();
    const os = OrdemServico.abrir({ clienteId: cenario.cliente.id, veiculoId: cenario.veiculo.id }, em(0));
    os.iniciarDiagnostico(em(1));
    os.incluirServico({ servicoId: cenario.servico.id, precoUnitario: preco(15000) }, em(2));
    os.incluirPeca({ pecaId: cenario.peca.id, quantidade: Quantidade.de(1), precoUnitario: preco(4000) }, em(2));
    await repo.salvar(os);

    const outroCliente = await salvarCliente('Bia', CPF_BIA);
    const outroVeiculo = Veiculo.registrar({ clienteId: outroCliente.id, placa: 'XYZ9876', marca: 'Fiat', modelo: 'Uno', ano: 2018 });
    await new VeiculoRepositoryAdapter(prisma).salvar(outroVeiculo);
    const outroServico = Servico.cadastrar({ nome: 'Alinhamento', preco: preco(9000) });
    await new ServicoRepositoryAdapter(prisma).salvar(outroServico);
    const outraPeca = Peca.cadastrar({ codigo: 'VEL-01', nome: 'Vela', preco: preco(2000), saldo: Quantidade.de(5) });
    await new PecaRepositoryAdapter(prisma).salvar(outraPeca);

    expect(await consultas.existePorCliente({ clienteId: cenario.cliente.id })).toBe(true);
    expect(await consultas.existePorCliente({ clienteId: outroCliente.id })).toBe(false);
    expect(await consultas.existePorVeiculo({ veiculoId: cenario.veiculo.id })).toBe(true);
    expect(await consultas.existePorVeiculo({ veiculoId: outroVeiculo.id })).toBe(false);
    expect(await consultas.existePorServico({ id: cenario.servico.id })).toBe(true);
    expect(await consultas.existePorServico({ id: outroServico.id })).toBe(false);
    expect(await consultas.existePorPeca({ id: cenario.peca.id })).toBe(true);
    expect(await consultas.existePorPeca({ id: outraPeca.id })).toBe(false);
  });
});
