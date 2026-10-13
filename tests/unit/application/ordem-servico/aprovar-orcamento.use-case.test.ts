import { beforeEach, describe, expect, test } from 'bun:test';
import { ConflitoError, NaoEncontradoError } from '@application/core/erros';
import { AprovarOrcamento } from '@application/ordem-servico/aprovar-orcamento.use-case';
import { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import { DomainError } from '@domain/core/domain-error';
import { Peca } from '@domain/estoque/peca.aggregate';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import { PublicadorEventosEmMemoria } from '../doubles/publicador-eventos-memoria.test';
import {
  ClienteRepositorioEmMemoria,
  OrdemServicoRepositorioEmMemoria,
  PecaRepositorioEmMemoria,
} from '../doubles/repositorios-em-memoria.test';
import { UnitOfWorkEmMemoria } from '../doubles/unit-of-work-em-memoria.test';

const CPF_MARIA = '529.982.247-25';
const CPF_OUTRO = '111.444.777-35';

describe('AprovarOrcamento', () => {
  let clientes: ClienteRepositorioEmMemoria;
  let ordens: OrdemServicoRepositorioEmMemoria;
  let pecas: PecaRepositorioEmMemoria;
  let eventos: PublicadorEventosEmMemoria;
  let aprovar: AprovarOrcamento;
  let maria: Cliente;
  let filtro: Peca;
  let pastilha: Peca;

  const novaPeca = (codigo: string, saldo: number) =>
    Peca.cadastrar({ codigo, nome: codigo, preco: Dinheiro.deCentavos(1000), saldo: Quantidade.de(saldo) });

  /** OS aguardando aprovação com os itens de peça informados. */
  const osAguardando = async (itens: Array<[Peca, number]>) => {
    const os = OrdemServico.abrir({ clienteId: maria.id, veiculoId: 'v1' });
    os.iniciarDiagnostico();
    os.incluirServico({ servicoId: 's1', precoUnitario: Dinheiro.deCentavos(15000) });
    for (const [peca, quantidade] of itens) {
      os.incluirPeca({ pecaId: peca.id, quantidade: Quantidade.de(quantidade), precoUnitario: peca.preco });
    }
    os.gerarOrcamento();
    os.enviarOrcamento();
    os.puxarEventos();
    await ordens.salvar(os);
    return os;
  };

  const saldo = async (peca: Peca) => (await pecas.buscarPorId({ id: peca.id }))!.saldo.valor;
  const status = async (os: OrdemServico) => (await ordens.buscarPorId({ id: os.id }))!.status.valor;

  beforeEach(async () => {
    clientes = new ClienteRepositorioEmMemoria();
    ordens = new OrdemServicoRepositorioEmMemoria();
    pecas = new PecaRepositorioEmMemoria();
    eventos = new PublicadorEventosEmMemoria();
    aprovar = new AprovarOrcamento(new UnitOfWorkEmMemoria({ ordens, pecas, clientes }), eventos);

    maria = Cliente.cadastrar({ nome: 'Maria', documento: CPF_MARIA });
    await clientes.salvar(maria);
    filtro = novaPeca('FO-01', 5);
    pastilha = novaPeca('PA-02', 1);
    await pecas.salvar(filtro);
    await pecas.salvar(pastilha);
  });

  test('aprova: a OS entra em execução e cada peça tem a baixa dada', async () => {
    const os = await osAguardando([[filtro, 2], [pastilha, 1]]);

    await aprovar.executar({ id: os.id, documento: CPF_MARIA });

    expect(await status(os)).toBe('EM_EXECUCAO');
    expect(await saldo(filtro)).toBe(3);
    expect(await saldo(pastilha)).toBe(0);
    expect(eventos.nomes).toEqual(['OrcamentoAprovado', 'ExecucaoIniciada', 'EstoqueBaixado', 'EstoqueBaixado']);
  });

  test('a mesma peça em dois itens: as baixas se somam, nenhuma se perde', async () => {
    const os = await osAguardando([[filtro, 2], [filtro, 1]]);

    await aprovar.executar({ id: os.id, documento: CPF_MARIA });

    expect(await saldo(filtro)).toBe(2);
  });

  test('OS só com serviços aprova sem mexer no estoque', async () => {
    const os = await osAguardando([]);

    await aprovar.executar({ id: os.id, documento: CPF_MARIA });

    expect(await status(os)).toBe('EM_EXECUCAO');
    expect(await saldo(filtro)).toBe(5);
    expect(eventos.nomes).toEqual(['OrcamentoAprovado', 'ExecucaoIniciada']);
  });

  test('falta de saldo em uma peça desfaz tudo: OS segue aguardando e nenhum saldo muda', async () => {
    const os = await osAguardando([[filtro, 2], [pastilha, 2]]);

    await expect(aprovar.executar({ id: os.id, documento: CPF_MARIA })).rejects.toThrow('Saldo insuficiente');

    expect(await status(os)).toBe('AGUARDANDO_APROVACAO');
    expect(await saldo(filtro)).toBe(5);
    expect(await saldo(pastilha)).toBe(1);
    expect(eventos.publicados).toHaveLength(0);
  });

  test('falha ao gravar a segunda peça desfaz a OS e a primeira peça (rollback do UnitOfWork)', async () => {
    const os = await osAguardando([[filtro, 2], [pastilha, 1]]);
    const salvarOriginal = pecas.salvar.bind(pecas);
    let chamadas = 0;
    pecas.salvar = async (peca) => {
      if (++chamadas === 2) throw new Error('falha de gravação');
      return salvarOriginal(peca);
    };

    await expect(aprovar.executar({ id: os.id, documento: CPF_MARIA })).rejects.toThrow('falha de gravação');

    expect(await status(os)).toBe('AGUARDANDO_APROVACAO');
    expect(await saldo(filtro)).toBe(5);
    expect(await saldo(pastilha)).toBe(1);
    expect(eventos.publicados).toHaveLength(0);
  });

  test('documento de outra pessoa vira NaoEncontradoError e nada muda', async () => {
    const os = await osAguardando([[filtro, 2]]);

    await expect(aprovar.executar({ id: os.id, documento: CPF_OUTRO })).rejects.toBeInstanceOf(NaoEncontradoError);
    expect(await status(os)).toBe('AGUARDANDO_APROVACAO');
    expect(await saldo(filtro)).toBe(5);
  });

  test('OS inexistente vira NaoEncontradoError', async () => {
    await expect(aprovar.executar({ id: 'nao-existe', documento: CPF_MARIA })).rejects.toBeInstanceOf(
      NaoEncontradoError,
    );
  });

  test('documento inválido vira DomainError', async () => {
    const os = await osAguardando([[filtro, 1]]);
    await expect(aprovar.executar({ id: os.id, documento: '111.111.111-11' })).rejects.toBeInstanceOf(DomainError);
  });

  test('OS que não está aguardando aprovação vira DomainError e o estoque não muda', async () => {
    const os = OrdemServico.abrir({ clienteId: maria.id, veiculoId: 'v1' });
    os.iniciarDiagnostico();
    os.incluirPeca({ pecaId: filtro.id, quantidade: Quantidade.de(1), precoUnitario: filtro.preco });
    await ordens.salvar(os);

    await expect(aprovar.executar({ id: os.id, documento: CPF_MARIA })).rejects.toBeInstanceOf(DomainError);
    expect(await saldo(filtro)).toBe(5);
  });

  test('peça da OS que não existe mais vira ConflitoError e desfaz a aprovação', async () => {
    const os = await osAguardando([[filtro, 1]]);
    await pecas.remover({ id: filtro.id });

    await expect(aprovar.executar({ id: os.id, documento: CPF_MARIA })).rejects.toBeInstanceOf(ConflitoError);
    expect(await status(os)).toBe('AGUARDANDO_APROVACAO');
  });
});
