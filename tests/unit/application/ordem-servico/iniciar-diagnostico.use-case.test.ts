import { beforeEach, describe, expect, test } from 'bun:test';
import { NaoEncontradoError } from '@application/core/erros';
import { IniciarDiagnostico } from '@application/ordem-servico/iniciar-diagnostico.use-case';
import { DomainError } from '@domain/core/domain-error';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { PublicadorEventosEmMemoria } from '../doubles/publicador-eventos-memoria.test';
import { OrdemServicoRepositorioEmMemoria  } from '../doubles/repositorios-em-memoria.test';

describe('IniciarDiagnostico', () => {
  let ordens: OrdemServicoRepositorioEmMemoria;
  let eventos: PublicadorEventosEmMemoria;
  let iniciar: IniciarDiagnostico;
  let os: OrdemServico;

  beforeEach(async () => {
    ordens = new OrdemServicoRepositorioEmMemoria();
    eventos = new PublicadorEventosEmMemoria();
    iniciar = new IniciarDiagnostico(ordens, eventos);
    os = OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' });
    await ordens.salvar(os);
  });

  test('move a OS de Recebida para Em diagnóstico e publica DiagnosticoIniciado', async () => {
    await iniciar.executar({ id: os.id });

    expect((await ordens.buscarPorId({ id: os.id }))!.status.valor).toBe('EM_DIAGNOSTICO');
    expect(eventos.nomes).toEqual(['DiagnosticoIniciado']);
  });

  test('OS inexistente vira NaoEncontradoError', async () => {
    await expect(iniciar.executar({ id: 'nao-existe' })).rejects.toBeInstanceOf(NaoEncontradoError);
  });

  test('transição inválida vira DomainError e o status não muda', async () => {
    await iniciar.executar({ id: os.id });

    await expect(iniciar.executar({ id: os.id })).rejects.toBeInstanceOf(DomainError);
    expect((await ordens.buscarPorId({ id: os.id }))!.status.valor).toBe('EM_DIAGNOSTICO');
    expect(eventos.publicados).toHaveLength(1);
  });
});
