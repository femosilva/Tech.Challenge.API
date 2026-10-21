import { beforeEach, describe, expect, test } from 'bun:test';
import { NaoEncontradoError } from '@application/core/erros';
import { EntregarVeiculo } from '@application/ordem-servico/acompanhamento/entregar-veiculo.use-case';
import { DomainError } from '@domain/core/domain-error';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { PublicadorEventosEmMemoria } from '../../doubles/publicador-eventos-memoria.test';
import { OrdemServicoRepositorioEmMemoria } from '../../doubles/repositorios-em-memoria.test';

describe('EntregarVeiculo', () => {
  let ordens: OrdemServicoRepositorioEmMemoria;
  let eventos: PublicadorEventosEmMemoria;
  let entregar: EntregarVeiculo;

  const osAte = async (ate: 'EM_EXECUCAO' | 'FINALIZADA') => {
    const os = OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' });
    os.iniciarDiagnostico();
    os.incluirServico({ servicoId: 's1', precoUnitario: Dinheiro.deCentavos(15000) });
    os.gerarOrcamento();
    os.enviarOrcamento();
    os.aprovarOrcamento();
    if (ate === 'FINALIZADA') os.finalizar();
    os.puxarEventos();
    await ordens.salvar(os);
    return os;
  };

  beforeEach(() => {
    ordens = new OrdemServicoRepositorioEmMemoria();
    eventos = new PublicadorEventosEmMemoria();
    entregar = new EntregarVeiculo(ordens, eventos);
  });

  test('move a OS de Finalizada para Entregue e publica VeiculoEntregue', async () => {
    const os = await osAte('FINALIZADA');

    await entregar.executar({ id: os.id });

    expect((await ordens.buscarPorId({ id: os.id }))!.status.valor).toBe('ENTREGUE');
    expect(eventos.nomes).toEqual(['VeiculoEntregue']);
  });

  test('OS inexistente vira NaoEncontradoError', async () => {
    await expect(entregar.executar({ id: 'nao-existe' })).rejects.toBeInstanceOf(NaoEncontradoError);
  });

  test('OS ainda em execução vira DomainError e nada muda', async () => {
    const os = await osAte('EM_EXECUCAO');

    await expect(entregar.executar({ id: os.id })).rejects.toBeInstanceOf(DomainError);
    expect((await ordens.buscarPorId({ id: os.id }))!.status.valor).toBe('EM_EXECUCAO');
    expect(eventos.publicados).toHaveLength(0);
  });
});
