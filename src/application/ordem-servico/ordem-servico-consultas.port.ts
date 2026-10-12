import type { OrdemServico } from "@domain/ordem-servico/ordem-servico.aggregate";

export interface OrdemServicoConsultas {
    existePorCliente(filtro: Pick<OrdemServico, "clienteId">): Promise<boolean>;
    existePorVeiculo(filtro: Pick<OrdemServico, "veiculoId">): Promise<boolean>;
}
