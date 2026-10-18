import type { OrdemServicoConsultas, TempoMedioExecucaoDto } from './ordem-servico-consultas.port';

export class ObterTempoMedioExecucao {
  constructor(private readonly consultas: OrdemServicoConsultas) {}

  async executar(): Promise<ObterTempoMedioExecucao.Output> {
    return this.consultas.tempoMedioExecucao();
  }
}

export namespace ObterTempoMedioExecucao {
  export type Output = TempoMedioExecucaoDto;
}
