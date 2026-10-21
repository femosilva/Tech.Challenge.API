import { describe, expect, it, spyOn } from 'bun:test';
import { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import type { DomainEvent } from '@domain/core/domain-event';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { LogPublicadorEventosAdapter, paraLinhaDeLog } from '@infrastructure/events/log-publicador-eventos.adapter';

const em = new Date(Date.UTC(2026, 0, 10, 10, 0));

const publicarEmMemoria = async (eventos: readonly DomainEvent[]) => {
  const linhas: string[] = [];
  await new LogPublicadorEventosAdapter((linha) => linhas.push(linha)).publicar(eventos);
  return linhas;
};

describe('LogPublicadorEventosAdapter', () => {
  it('registra uma linha JSON por evento, na ordem, com nome, horário e identificadores', async () => {
    const os = OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' }, em);
    os.iniciarDiagnostico(em);

    const linhas = await publicarEmMemoria(os.puxarEventos());

    expect(linhas.map((l) => JSON.parse(l))).toEqual([
      { evento: 'OSAberta', ocorridoEm: '2026-01-10T10:00:00.000Z', osId: os.id },
      { evento: 'DiagnosticoIniciado', ocorridoEm: '2026-01-10T10:00:00.000Z', osId: os.id },
    ]);
  });

  it('eventos sem nada a publicar não geram log', async () => {
    expect(await publicarEmMemoria([])).toEqual([]);
  });

  it('nenhum dado pessoal dos eventos reais do domínio chega ao log', async () => {
    const cliente = Cliente.cadastrar({ nome: 'Ana Souza', documento: '529.982.247-25' });
    const veiculo = Veiculo.registrar({ clienteId: cliente.id, placa: 'ABC-1D23', marca: 'VW', modelo: 'Gol', ano: 2020 });

    const log = (await publicarEmMemoria([...cliente.puxarEventos(), ...veiculo.puxarEventos()])).join('\n');

    expect(log).toContain('ClienteCadastrado');
    expect(log).toContain(cliente.id);
    for (const pessoal of ['Ana', 'Souza', '52998224725', '529.982', 'ABC1D23', 'ABC-1D23', 'Gol']) {
      expect(log).not.toContain(pessoal);
    }
  });

  it('um campo novo que não seja identificador fica de fora por padrão', () => {
    const evento: DomainEvent<'EventoNovo', { osId: string; clienteNome: string; documento: string }> = {
      nome: 'EventoNovo',
      ocorridoEm: em,
      osId: 'o1',
      clienteNome: 'Ana Souza',
      documento: '52998224725',
    };

    expect(JSON.parse(paraLinhaDeLog(evento))).toEqual({
      evento: 'EventoNovo',
      ocorridoEm: '2026-01-10T10:00:00.000Z',
      osId: 'o1',
    });
  });

  it('sem logger informado, escreve em console.info', async () => {
    const espiao = spyOn(console, 'info').mockImplementation(() => {});
    try {
      const evento: DomainEvent<'OSAberta', { osId: string }> = { nome: 'OSAberta', ocorridoEm: em, osId: 'o1' };
      await new LogPublicadorEventosAdapter().publicar([evento]);

      expect(espiao).toHaveBeenCalledTimes(1);
      expect(JSON.parse(espiao.mock.calls[0]![0] as string)).toMatchObject({ evento: 'OSAberta', osId: 'o1' });
    } finally {
      espiao.mockRestore();
    }
  });
});
