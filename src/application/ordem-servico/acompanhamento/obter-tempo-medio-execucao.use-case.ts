import type { OrdemServicoConsultas, TempoMedioExecucaoDto } from '@application/ordem-servico/ordem-servico-consultas.port';

export class ObterTempoMedioExecucao {
  constructor(private readonly consultas: OrdemServicoConsultas) {}

  async executar(): Promise<ObterTempoMedioExecucao.Output> {
    return this.consultas.tempoMedioExecucao();
  }
}

export namespace ObterTempoMedioExecucao {
  export type Output = TempoMedioExecucaoDto;
}
