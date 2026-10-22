import { afterAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { CredenciaisInvalidasError } from '@application/core/erros';
import { BunHashSenhaAdapter } from '@infrastructure/auth/bun-hash-senha.adapter';
import { ALGORITMO_JWT } from '@infrastructure/auth/jwt-provedor-token.adapter';
import { UsuarioRepositoryAdapter } from '@infrastructure/persistence/identidade/usuario-repository.adapter';
import { semearUsuariosDemo } from '@infrastructure/persistence/identidade/usuarios-demo.seed';
import { jwtVerify } from 'jose';
import { compor } from '../../src/composition-root';
import { limparBanco, prisma } from '../integration/support/banco-de-teste';
import { CPF_ANA, CPF_BIA, inserirOrdem } from '../integration/support/dados-de-teste';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
// O publicador captura `console.info` ao ser construído: o espião precisa existir antes do `compor`.
const eventos = spyOn(console, 'info').mockImplementation(() => {});
const { prisma: prismaDaComposicao, casos } = compor({
  // o banco-de-teste já garantiu que a URL existe e termina em _test
  databaseUrl: process.env.TEST_DATABASE_URL!,
  jwt: { segredo: SEGREDO, expiracao: '1h' },
});

beforeEach(async () => {
  eventos.mockClear();
  await limparBanco();
});
afterAll(async () => {
  eventos.mockRestore();
  await prismaDaComposicao.$disconnect();
  await prisma.$disconnect();
});

describe('compor', () => {
  it('entrega os 36 casos de uso, todos com executar', () => {
    const todos = Object.values(casos);

    expect(todos).toHaveLength(36);
    for (const caso of todos) expect(typeof caso.executar).toBe('function');
  });

  it('autentica um usuário e emite token que o guard poderá validar com o mesmo segredo', async () => {
    await semearUsuariosDemo(new UsuarioRepositoryAdapter(prisma), new BunHashSenhaAdapter());

    const { token } = await casos.autenticar.executar({ email: 'admin@oficina.local', senha: 'admin123' });
    const { payload } = await jwtVerify(token, new TextEncoder().encode(SEGREDO), { algorithms: [ALGORITMO_JWT] });

    expect(payload.papel).toBe('ADMINISTRADOR');
    expect(payload.sub).toBeString();
    await expect(casos.autenticar.executar({ email: 'admin@oficina.local', senha: 'errada' })).rejects.toBeInstanceOf(
      CredenciaisInvalidasError,
    );
  });

  it('percorre a OS da abertura à entrega: orçamento, aprovação com baixa de estoque e métrica', async () => {
    const { id: clienteId } = await casos.cadastrarCliente.executar({ nome: 'Ana', documento: CPF_ANA });
    await casos.cadastrarVeiculo.executar({ clienteId, placa: 'ABC1D23', marca: 'VW', modelo: 'Gol', ano: 2020 });
    const { id: servicoId } = await casos.cadastrarServico.executar({ nome: 'Troca de óleo', precoCentavos: 15000 });
    const { id: pecaId } = await casos.cadastrarPeca.executar({
      codigo: 'FO-1',
      nome: 'Filtro de óleo',
      precoCentavos: 4000,
      saldoInicial: 10,
    });

    const { id } = await casos.abrirOS.executar({ documento: CPF_ANA, placa: 'ABC1D23' });
    await casos.iniciarDiagnostico.executar({ id });
    await casos.incluirServico.executar({ id, servicoId });
    await casos.incluirPeca.executar({ id, pecaId, quantidade: 3 });
    await casos.enviarOrcamento.executar({ id });

    const aguardando = await casos.consultarAndamento.executar({ id, documento: CPF_ANA });
    expect(aguardando).toMatchObject({ status: 'AGUARDANDO_APROVACAO', totalCentavos: 27000 });
    expect((await casos.obterPeca.executar({ id: pecaId })).saldo).toBe(10);

    await casos.aprovarOrcamento.executar({ id, documento: CPF_ANA });
    expect((await casos.detalharOrdemServico.executar({ id })).status).toBe('EM_EXECUCAO');
    expect((await casos.obterPeca.executar({ id: pecaId })).saldo).toBe(7);

    await casos.finalizarServico.executar({ id });
    await casos.entregarVeiculo.executar({ id });
    expect((await casos.detalharOrdemServico.executar({ id })).status).toBe('ENTREGUE');
    expect((await casos.listarOrdensServico.executar()).total).toBe(1);
    expect((await casos.obterTempoMedioExecucao.executar()).ordensConsideradas).toBe(1);

    // os eventos passaram pelo publicador (uma linha de log JSON por evento)
    expect(eventos.mock.calls.length).toBeGreaterThan(0);
    for (const [linha] of eventos.mock.calls) expect(JSON.parse(String(linha)).evento).toBeString();
  });

  it('as guardas de vínculo do cliente respondem antes do banco: uma para veículos, outra para ordens de serviço', async () => {
    const { id: anaId } = await casos.cadastrarCliente.executar({ nome: 'Ana', documento: CPF_ANA });
    const { id: veiculoId } = await casos.cadastrarVeiculo.executar({
      clienteId: anaId,
      placa: 'ABC1D23',
      marca: 'VW',
      modelo: 'Gol',
      ano: 2020,
    });
    await expect(casos.removerCliente.executar({ id: anaId })).rejects.toMatchObject({ message: 'Cliente possui veículos' });

    // Bia não tem veículo, mas tem uma OS (inserida direto no banco, com o veículo da Ana, só para isolar a guarda de OS).
    // A mensagem do banco seria "veículos ou ordens de serviço": esta é a da Application. Comparação exata: por substring, "veículos" também casaria com a do banco.
    const { id: biaId } = await casos.cadastrarCliente.executar({ nome: 'Bia', documento: CPF_BIA });
    await inserirOrdem({ clienteId: biaId, veiculoId });
    await expect(casos.removerCliente.executar({ id: biaId })).rejects.toMatchObject({ message: 'Cliente possui ordens de serviço' });
  });
});
