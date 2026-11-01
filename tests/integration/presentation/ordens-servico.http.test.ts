import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { criarApiDeTeste } from '../support/api-http';
import { limparBanco, prisma } from '../support/banco-de-teste';
import { CPF_ANA, CPF_BIA } from '../support/dados-de-teste';

const INT_MAXIMO = 2_147_483_647;
const CPF_SEM_CADASTRO = '390.533.447-05';
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const api = criarApiDeTeste();
const { requisitar } = api;

beforeEach(limparBanco);
afterAll(async () => {
  await api.encerrar();
  await prisma.$disconnect();
});

/** Ana (ABC1D23) e Bia (BBB2B22), um serviço de R$ 150,00 e uma peça de R$ 40,00 com saldo 10. */
async function cenario() {
  const ana = (await requisitar('POST', '/api/v1/clientes', { papel: 'ATENDENTE', corpo: { nome: 'Ana', documento: CPF_ANA } })).corpo.id;
  const bia = (await requisitar('POST', '/api/v1/clientes', { papel: 'ATENDENTE', corpo: { nome: 'Bia', documento: CPF_BIA } })).corpo.id;
  await requisitar('POST', '/api/v1/veiculos', { papel: 'ATENDENTE', corpo: { clienteId: ana, placa: 'ABC1D23', marca: 'VW', modelo: 'Gol', ano: 2020 } });
  await requisitar('POST', '/api/v1/veiculos', { papel: 'ATENDENTE', corpo: { clienteId: bia, placa: 'BBB2B22', marca: 'Fiat', modelo: 'Uno', ano: 2019 } });
  const servicoId = (await requisitar('POST', '/api/v1/servicos', { papel: 'ADMINISTRADOR', corpo: { nome: 'Troca de óleo', precoCentavos: 15000 } })).corpo.id;
  const pecaId = (
    await requisitar('POST', '/api/v1/pecas', {
      papel: 'ADMINISTRADOR',
      corpo: { codigo: 'FO-001', nome: 'Filtro de óleo', precoCentavos: 4000, saldoInicial: 10 },
    })
  ).corpo.id;
  return { servicoId: servicoId as string, pecaId: pecaId as string };
}

const abrir = (documento = CPF_ANA, placa = 'ABC1D23') =>
  requisitar('POST', '/api/v1/ordens-servico', { papel: 'ATENDENTE', corpo: { documento, placa } });
const abrirId = async (documento = CPF_ANA, placa = 'ABC1D23') => (await abrir(documento, placa)).corpo.id as string;

const uri = (id: string) => `/api/v1/ordens-servico/${id}`;
const equipe = (id: string, acao: string, papel: 'ATENDENTE' | 'MECANICO' | 'ADMINISTRADOR', corpo?: unknown) =>
  requisitar('POST', `${uri(id)}/${acao}`, { papel, corpo });
const detalhe = async (id: string) => (await requisitar('GET', uri(id), { papel: 'MECANICO' })).corpo;
const saldoDe = async (pecaId: string) => (await requisitar('GET', `/api/v1/pecas/${pecaId}`, { papel: 'MECANICO' })).corpo.saldo as number;

/** Rotas do cliente: sem token, só o documento no cabeçalho. */
const cliente = (metodo: string, id: string, resto: string, documento?: string) =>
  requisitar(metodo, `/api/v1/cliente/ordens-servico/${id}${resto}`, { cabecalhos: documento === undefined ? {} : { 'x-documento': documento } });

/** Leva uma OS até "Aguardando aprovação" com os itens pedidos. */
async function ateOrcamento(id: string, itens: { servicoId?: string; pecaId?: string; quantidade?: number }) {
  if (itens.servicoId) await equipe(id, 'servicos', 'MECANICO', { servicoId: itens.servicoId });
  if (itens.pecaId) await equipe(id, 'pecas', 'MECANICO', { pecaId: itens.pecaId, quantidade: itens.quantidade ?? 1 });
  await equipe(id, 'iniciar-diagnostico', 'MECANICO');
  await equipe(id, 'enviar-orcamento', 'ATENDENTE');
}

describe('ordens de serviço (Postgres real)', () => {
  it('fluxo completo: abre, inclui itens, diagnostica, envia o orçamento, o cliente aprova (baixa o estoque), executa, entrega e entra na métrica', async () => {
    const { servicoId, pecaId } = await cenario();

    const aberta = await abrir();
    const id = aberta.corpo.id as string;
    expect(aberta.status).toBe(201);
    expect(aberta.headers.get('location')).toBe(uri(id));
    expect(await detalhe(id)).toMatchObject({ status: 'RECEBIDA', totalCentavos: 0, orcamento: null, inicioExecucao: null, fimExecucao: null });

    expect((await equipe(id, 'servicos', 'MECANICO', { servicoId })).status).toBe(204);
    expect((await equipe(id, 'pecas', 'ATENDENTE', { pecaId, quantidade: 2 })).status).toBe(204);
    expect((await equipe(id, 'iniciar-diagnostico', 'MECANICO')).status).toBe(204);
    expect((await equipe(id, 'enviar-orcamento', 'ATENDENTE')).status).toBe(204);

    const aguardando = await detalhe(id);
    expect(aguardando).toMatchObject({
      status: 'AGUARDANDO_APROVACAO',
      totalCentavos: 23000,
      itensServico: [{ servicoId, precoUnitarioCentavos: 15000 }],
      itensPeca: [{ pecaId, quantidade: 2, precoUnitarioCentavos: 4000 }],
      orcamento: { enviado: true, decisao: 'PENDENTE', totalCentavos: 23000 },
    });
    expect(await saldoDe(pecaId)).toBe(10); // o estoque só baixa na aprovação

    const andamento = await cliente('GET', id, '', CPF_ANA);
    expect(andamento.status).toBe(200);
    expect(andamento.corpo.status).toBe('AGUARDANDO_APROVACAO');

    expect((await cliente('POST', id, '/orcamento/aprovar', CPF_ANA)).status).toBe(204);
    expect((await detalhe(id)).status).toBe('EM_EXECUCAO');
    expect(await saldoDe(pecaId)).toBe(8);

    expect((await equipe(id, 'finalizar', 'MECANICO')).status).toBe(204);
    expect((await equipe(id, 'entregar', 'ATENDENTE')).status).toBe(204);

    const final = await detalhe(id);
    expect(final.status).toBe('ENTREGUE');
    expect(final.orcamento.decisao).toBe('APROVADO');
    expect(final.historico.map((registro: { status: string }) => registro.status)).toEqual([
      'RECEBIDA',
      'EM_DIAGNOSTICO',
      'AGUARDANDO_APROVACAO',
      'EM_EXECUCAO',
      'FINALIZADA',
      'ENTREGUE',
    ]);
    for (const instante of [final.abertaEm, final.inicioExecucao, final.fimExecucao, ...final.historico.map((r: { alteradoEm: string }) => r.alteradoEm)]) {
      expect(instante).toMatch(ISO_UTC);
    }
    expect(new Date(final.fimExecucao).getTime()).toBeGreaterThanOrEqual(new Date(final.inicioExecucao).getTime());

    const metricas = await requisitar('GET', '/api/v1/metricas/tempo-medio-execucao', { papel: 'ADMINISTRADOR' });
    expect(metricas.status).toBe(200);
    expect(metricas.corpo.ordensConsideradas).toBe(1);
    expect(metricas.corpo.mediaMs).toBeGreaterThanOrEqual(0);
  });

  it('a média de execução é null enquanto nenhuma OS foi concluída', async () => {
    const { servicoId } = await cenario();
    await ateOrcamento(await abrirId(), { servicoId });

    const metricas = await requisitar('GET', '/api/v1/metricas/tempo-medio-execucao', { papel: 'ADMINISTRADOR' });

    expect(metricas.corpo).toEqual({ ordensConsideradas: 0, mediaMs: null });
  });

  it('a rejeição do cliente devolve a OS ao diagnóstico; dá para incluir itens e reenviar um novo orçamento', async () => {
    const { servicoId, pecaId } = await cenario();
    const id = await abrirId(CPF_BIA, 'BBB2B22');
    await ateOrcamento(id, { servicoId });

    expect((await cliente('POST', id, '/orcamento/rejeitar', CPF_BIA)).status).toBe(204);
    const rejeitada = await detalhe(id);
    expect(rejeitada.status).toBe('EM_DIAGNOSTICO');
    expect(rejeitada.orcamento).toMatchObject({ decisao: 'REJEITADO', totalCentavos: 15000 });

    expect((await equipe(id, 'pecas', 'MECANICO', { pecaId, quantidade: 1 })).status).toBe(204);
    expect((await equipe(id, 'enviar-orcamento', 'ATENDENTE')).status).toBe(204);
    const reenviada = await detalhe(id);
    expect(reenviada.status).toBe('AGUARDANDO_APROVACAO');
    expect(reenviada.orcamento).toMatchObject({ decisao: 'PENDENTE', totalCentavos: 19000 });
    expect(reenviada.historico.map((registro: { status: string }) => registro.status)).toEqual([
      'RECEBIDA',
      'EM_DIAGNOSTICO',
      'AGUARDANDO_APROVACAO',
      'EM_DIAGNOSTICO',
      'AGUARDANDO_APROVACAO',
    ]);
  });

  it('aprovar sem saldo é recusado (422) e nada muda: a OS segue aguardando e o estoque não baixa', async () => {
    const { pecaId } = await cenario();
    const id = await abrirId();
    await ateOrcamento(id, { pecaId, quantidade: 50 });

    const resposta = await cliente('POST', id, '/orcamento/aprovar', CPF_ANA);

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro).toEqual({ codigo: 'DomainError', mensagem: 'Saldo insuficiente da peça FO-001' });
    expect((await detalhe(id)).status).toBe('AGUARDANDO_APROVACAO');
    expect(await saldoDe(pecaId)).toBe(10);
  });

  it('o cliente só enxerga a própria OS: OS inexistente e documento que não confere dão a mesma resposta 404', async () => {
    const { servicoId } = await cenario();
    const id = await abrirId();
    await ateOrcamento(id, { servicoId });

    const documentoDeOutro = await cliente('GET', id, '', CPF_BIA);
    const osInexistente = await cliente('GET', 'nao-existe', '', CPF_ANA);
    const decisaoDeOutro = await cliente('POST', id, '/orcamento/aprovar', CPF_BIA);

    expect([documentoDeOutro.status, osInexistente.status, decisaoDeOutro.status]).toEqual([404, 404, 404]);
    expect(documentoDeOutro.corpo).toEqual(osInexistente.corpo);
    expect((await detalhe(id)).status).toBe('AGUARDANDO_APROVACAO'); // a tentativa do outro não decidiu nada
  });

  it('o cliente sem o cabeçalho leva 400, e com documento malformado leva 422', async () => {
    const { servicoId } = await cenario();
    const id = await abrirId();
    await ateOrcamento(id, { servicoId });

    const semCabecalho = await cliente('GET', id, '');
    const malformado = await cliente('GET', id, '', '123');
    const decisaoSemCabecalho = await cliente('POST', id, '/orcamento/aprovar');

    expect([semCabecalho.status, malformado.status, decisaoSemCabecalho.status]).toEqual([400, 422, 400]);
    expect(semCabecalho.corpo.erro.codigo).toBe('VALIDACAO');
    expect(malformado.corpo.erro.mensagem).toBe('CPF ou CNPJ inválido');
    expect((await detalhe(id)).status).toBe('AGUARDANDO_APROVACAO');
  });

  it('o cliente não consegue decidir duas vezes: o orçamento já decidido dá 422', async () => {
    const { servicoId } = await cenario();
    const id = await abrirId();
    await ateOrcamento(id, { servicoId });
    await cliente('POST', id, '/orcamento/aprovar', CPF_ANA);

    const denovo = await cliente('POST', id, '/orcamento/aprovar', CPF_ANA);
    const contrario = await cliente('POST', id, '/orcamento/rejeitar', CPF_ANA);

    expect([denovo.status, contrario.status]).toEqual([422, 422]);
    expect(denovo.corpo.erro.mensagem).toBe('Orçamento já foi decidido');
    expect((await detalhe(id)).status).toBe('EM_EXECUCAO');
  });

  it('ações fora de ordem são recusadas com 422 e a mensagem do domínio, sem mudar a OS', async () => {
    const { servicoId } = await cenario();
    const id = await abrirId();

    const finalizarCedo = await equipe(id, 'finalizar', 'MECANICO');
    const orcamentoCedo = await equipe(id, 'enviar-orcamento', 'ATENDENTE');
    const entregarCedo = await equipe(id, 'entregar', 'ATENDENTE');
    expect(finalizarCedo.corpo.erro.mensagem).toBe('Transição inválida: RECEBIDA -> FINALIZADA');
    expect(orcamentoCedo.corpo.erro.mensagem).toBe('Orçamento só pode ser gerado com a OS em diagnóstico');
    expect(entregarCedo.corpo.erro.mensagem).toBe('Transição inválida: RECEBIDA -> ENTREGUE');

    await equipe(id, 'iniciar-diagnostico', 'MECANICO');
    const diagnosticoDeNovo = await equipe(id, 'iniciar-diagnostico', 'MECANICO');
    expect(diagnosticoDeNovo.corpo.erro.mensagem).toBe('Transição inválida: EM_DIAGNOSTICO -> EM_DIAGNOSTICO');

    await equipe(id, 'servicos', 'MECANICO', { servicoId });
    await equipe(id, 'enviar-orcamento', 'ATENDENTE');
    const itemTarde = await equipe(id, 'servicos', 'MECANICO', { servicoId });
    expect(itemTarde.status).toBe(422);
    expect(itemTarde.corpo.erro.mensagem).toBe('Serviços e peças só podem ser alterados em Recebida ou Em diagnóstico');

    expect([finalizarCedo.status, orcamentoCedo.status, entregarCedo.status, diagnosticoDeNovo.status]).toEqual([422, 422, 422, 422]);
    const atual = await detalhe(id);
    expect(atual.status).toBe('AGUARDANDO_APROVACAO');
    expect(atual.itensServico).toHaveLength(1);
  });

  it('abertura: cliente sem cadastro, veículo de outro cliente ou placa inexistente são 422 de referência; nada é criado', async () => {
    await cenario();

    const semCliente = await abrir(CPF_SEM_CADASTRO, 'ABC1D23');
    const veiculoDeOutro = await abrir(CPF_ANA, 'BBB2B22');
    const placaInexistente = await abrir(CPF_ANA, 'ZZZ9Z99');

    expect([semCliente.status, veiculoDeOutro.status, placaInexistente.status]).toEqual([422, 422, 422]);
    expect(semCliente.corpo.erro).toEqual({ codigo: 'ReferenciaInvalidaError', mensagem: 'Cliente não encontrado para o documento informado' });
    expect(veiculoDeOutro.corpo.erro.mensagem).toBe('Veículo não pertence ao cliente');
    expect(placaInexistente.corpo.erro.mensagem).toBe('Veículo não encontrado para a placa informada');
    expect(await prisma.ordemServico.count()).toBe(0);
  });

  it('abertura: documento e placa malformados são regra do domínio (422) e corpo fora do formato é 400', async () => {
    await cenario();

    const documento = await abrir('123', 'ABC1D23');
    const placa = await abrir(CPF_ANA, 'XX-1');
    const formato = await requisitar('POST', '/api/v1/ordens-servico', { papel: 'ATENDENTE', corpo: { documento: CPF_ANA } });

    expect([documento.status, placa.status, formato.status]).toEqual([422, 422, 400]);
    expect(documento.corpo.erro.mensagem).toBe('CPF ou CNPJ inválido');
    expect(placa.corpo.erro.mensagem).toBe('Placa inválida');
    expect(await prisma.ordemServico.count()).toBe(0);
  });

  it('itens: serviço ou peça inexistentes são 422, quantidade zero é 422, acima do teto do banco é 400 e OS inexistente é 404', async () => {
    const { pecaId } = await cenario();
    const id = await abrirId();

    const servicoInexistente = await equipe(id, 'servicos', 'MECANICO', { servicoId: 'nao-existe' });
    const pecaInexistente = await equipe(id, 'pecas', 'MECANICO', { pecaId: 'nao-existe', quantidade: 1 });
    const quantidadeZero = await equipe(id, 'pecas', 'MECANICO', { pecaId, quantidade: 0 });
    const acimaDoTeto = await equipe(id, 'pecas', 'MECANICO', { pecaId, quantidade: INT_MAXIMO + 1 });
    const osInexistente = await equipe('nao-existe', 'servicos', 'MECANICO', { servicoId: 'qualquer' });

    expect([servicoInexistente.status, pecaInexistente.status, quantidadeZero.status, acimaDoTeto.status, osInexistente.status]).toEqual([422, 422, 422, 400, 404]);
    expect(servicoInexistente.corpo.erro.codigo).toBe('ReferenciaInvalidaError');
    expect(quantidadeZero.corpo.erro.mensagem).toBe('Quantidade da peça deve ser maior que zero');
    const atual = await detalhe(id);
    expect(atual.itensServico).toHaveLength(0);
    expect(atual.itensPeca).toHaveLength(0);
  });

  it('cada papel só faz o que lhe cabe: a recusa é 403 e a OS não muda', async () => {
    const { servicoId } = await cenario();
    const mecanicoAbre = await requisitar('POST', '/api/v1/ordens-servico', { papel: 'MECANICO', corpo: { documento: CPF_ANA, placa: 'ABC1D23' } });
    expect(mecanicoAbre.status).toBe(403);
    expect(await prisma.ordemServico.count()).toBe(0);

    const id = await abrirId();
    const atendenteDiagnostica = await equipe(id, 'iniciar-diagnostico', 'ATENDENTE');
    expect(atendenteDiagnostica.status).toBe(403);
    expect((await detalhe(id)).status).toBe('RECEBIDA');

    await ateOrcamento(id, { servicoId });
    await cliente('POST', id, '/orcamento/aprovar', CPF_ANA);
    const atendenteFinaliza = await equipe(id, 'finalizar', 'ATENDENTE');
    expect(atendenteFinaliza.status).toBe(403);
    await equipe(id, 'finalizar', 'MECANICO');
    const mecanicoEntrega = await equipe(id, 'entregar', 'MECANICO');
    expect(mecanicoEntrega.status).toBe(403);
    expect((await detalhe(id)).status).toBe('FINALIZADA');

    for (const papel of ['ATENDENTE', 'MECANICO'] as const) {
      expect((await requisitar('GET', '/api/v1/metricas/tempo-medio-execucao', { papel })).status).toBe(403);
    }
  });

  it('o administrador pode executar as ações da equipe', async () => {
    const { servicoId } = await cenario();

    const aberta = await requisitar('POST', '/api/v1/ordens-servico', { papel: 'ADMINISTRADOR', corpo: { documento: CPF_ANA, placa: 'ABC1D23' } });
    const id = aberta.corpo.id as string;
    await equipe(id, 'servicos', 'ADMINISTRADOR', { servicoId });
    const diagnostico = await equipe(id, 'iniciar-diagnostico', 'ADMINISTRADOR');
    const orcamento = await equipe(id, 'enviar-orcamento', 'ADMINISTRADOR');

    expect([aberta.status, diagnostico.status, orcamento.status]).toEqual([201, 204, 204]);
    expect((await detalhe(id)).status).toBe('AGUARDANDO_APROVACAO');
  });

  it('OS inexistente na URL é 404 em consulta e em cada transição', async () => {
    await cenario();

    const consulta = await requisitar('GET', uri('nao-existe'), { papel: 'ATENDENTE' });
    const transicoes = [
      await equipe('nao-existe', 'iniciar-diagnostico', 'MECANICO'),
      await equipe('nao-existe', 'enviar-orcamento', 'ATENDENTE'),
      await equipe('nao-existe', 'finalizar', 'MECANICO'),
      await equipe('nao-existe', 'entregar', 'ATENDENTE'),
    ];

    expect(consulta.status).toBe(404);
    expect(transicoes.map((resposta) => resposta.status)).toEqual([404, 404, 404, 404]);
  });

  describe('listagem', () => {
    it('pagina, ordena da mais recente para a mais antiga e informa o total', async () => {
      await cenario();
      const ids = [await abrirId(), await abrirId(), await abrirId()];

      const padrao = await requisitar('GET', '/api/v1/ordens-servico', { papel: 'ATENDENTE' });
      expect(padrao.status).toBe(200);
      expect(padrao.corpo).toMatchObject({ pagina: 1, tamanho: 20, total: 3 });
      expect(padrao.corpo.itens).toHaveLength(3);
      const abertas = padrao.corpo.itens.map((item: { abertaEm: string }) => item.abertaEm);
      expect(abertas).toEqual([...abertas].sort().reverse());
      expect(padrao.corpo.itens.map((item: { id: string }) => item.id).sort()).toEqual([...ids].sort());
      expect(padrao.corpo.itens[0]).toMatchObject({ status: 'RECEBIDA', totalCentavos: 0 });

      const segunda = await requisitar('GET', '/api/v1/ordens-servico?pagina=2&tamanho=2', { papel: 'ATENDENTE' });
      expect(segunda.corpo).toMatchObject({ pagina: 2, tamanho: 2, total: 3 });
      expect(segunda.corpo.itens).toHaveLength(1);
    });

    it('limita o tamanho da página a 100 e devolve página vazia além do fim', async () => {
      await cenario();
      await abrirId();

      const grande = await requisitar('GET', '/api/v1/ordens-servico?tamanho=500', { papel: 'ATENDENTE' });
      const alemDoFim = await requisitar('GET', '/api/v1/ordens-servico?pagina=50', { papel: 'ATENDENTE' });
      const extremo = await requisitar('GET', `/api/v1/ordens-servico?pagina=${INT_MAXIMO}&tamanho=100`, { papel: 'ATENDENTE' });

      expect(grande.corpo.tamanho).toBe(100);
      expect(alemDoFim.corpo).toMatchObject({ pagina: 50, total: 1, itens: [] });
      expect([extremo.status, extremo.corpo.itens]).toEqual([200, []]);
    });

    it('parâmetros fora do formato dão 400', async () => {
      for (const consulta of ['pagina=0', 'pagina=-1', 'tamanho=0', 'pagina=1.5', 'tamanho=abc', 'ordem=asc']) {
        const resposta = await requisitar('GET', `/api/v1/ordens-servico?${consulta}`, { papel: 'ATENDENTE' });
        expect([consulta, resposta.status]).toEqual([consulta, 400]);
      }
    });
  });

  // Lacuna conhecida, fora da Presentation: o total do orçamento é a soma de preço x quantidade e o domínio não
  // limita essa soma. Acima de 2147483647 o Int do Postgres estoura e o envio do orçamento vira 500 (a OS fica
  // intacta, em diagnóstico). A correção é um teto para o total no domínio.
  it.todo('enviar orçamento cujo total passa do limite do banco deve ser recusado com 422 (hoje: 500)');
});
