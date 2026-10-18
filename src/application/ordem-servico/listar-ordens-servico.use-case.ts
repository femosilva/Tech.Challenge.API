import type { OrdemServicoConsultas, OrdemServicoResumoDto, Pagina, Paginacao } from './ordem-servico-consultas.port';

const TAMANHO_PADRAO = 20;
const TAMANHO_MAXIMO = 100;

/** Valor ausente ou inválido cai no padrão, em vez de virar erro. */
const inteiroPositivo = (valor: number | undefined, padrao: number): number =>
  valor !== undefined && Number.isInteger(valor) && valor > 0 ? valor : padrao;

export class ListarOrdensServico {
  constructor(private readonly consultas: OrdemServicoConsultas) {}

  async executar(input: ListarOrdensServico.Input = {}): Promise<ListarOrdensServico.Output> {
    return this.consultas.listar({
      pagina: inteiroPositivo(input.pagina, 1),
      tamanho: Math.min(inteiroPositivo(input.tamanho, TAMANHO_PADRAO), TAMANHO_MAXIMO),
    });
  }
}

export namespace ListarOrdensServico {
  export type Input = Partial<Paginacao>;
  export type Output = Pagina<OrdemServicoResumoDto>;
}
