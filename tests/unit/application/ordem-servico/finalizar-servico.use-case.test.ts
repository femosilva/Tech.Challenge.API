import { beforeEach, describe, expect, test } from 'bun:test';
import { NaoEncontradoError } from '@application/core/erros';
import { FinalizarServico } from '@application/ordem-servico/finalizar-servico.use-case';
import { DomainError } from '@domain/core/domain-error';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { PublicadorEventosEmMemoria } from '../doubles/publicador-eventos-memoria.test';
import { OrdemServicoRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';

describe('FinalizarServico', () => {
  let ordens: OrdemServicoRepositorioEmMemoria;
  let eventos: PublicadorEventosEmMemoria;
  let finalizar: FinalizarServico;

  const osEmExecucao = async () => {
    const os = OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' });
    os.iniciarDiagnostico();
    os.incluirServico({ servicoId: 's1', precoUnitario: Dinheiro.deCentavos(15000) });
    os.gerarOrcamento();
    os.enviarOrcamento();
    os.aprovarOrcamento();
    os.puxarEventos();
    await ordens.salvar(os);
    return os;
  };

  beforeEach(() => {
    ordens = new OrdemServicoRepositorioEmMemoria();
    eventos = new PublicadorEventosEmMemoria();
    finalizar = new FinalizarServico(ordens, eventos);
  });

  test('move a OS de Em execução para Finalizada, registra o fim e publica OSFinalizada', async () => {
    const os = await osEmExecucao();

    await finalizar.executar({ id: os.id });

    const salva = (await ordens.buscarPorId({ id: os.id }))!;
    expect(salva.status.valor).toBe('FINALIZADA');
    expect(salva.fimExecucao).toBeInstanceOf(Date);
    expect(salva.duracaoExecucaoMs).toBeGreaterThanOrEqual(0);
    expect(eventos.nomes).toEqual(['OSFinalizada']);
  });

  test('OS inexistente vira NaoEncontradoError', async () => {
    await expect(finalizar.executar({ id: 'nao-existe' })).rejects.toBeInstanceOf(NaoEncontradoError);
  });

  test('OS que não está em execução vira DomainError e nada muda', async () => {
    const os = OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' });
    await ordens.salvar(os);

    await expect(finalizar.executar({ id: os.id })).rejects.toBeInstanceOf(DomainError);
    expect((await ordens.buscarPorId({ id: os.id }))!.status.valor).toBe('RECEBIDA');
    expect(eventos.publicados).toHaveLength(0);
  });
});
