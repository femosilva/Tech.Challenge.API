import type { OrdemServico } from "@domain/ordem-servico/ordem-servico.aggregate";
import type { Servico } from '@domain/catalogo/servico.aggregate';

export interface OrdemServicoConsultas {
    existePorCliente(filtro: Pick<OrdemServico, "clienteId">): Promise<boolean>;
    existePorVeiculo(filtro: Pick<OrdemServico, "veiculoId">): Promise<boolean>;
    existePorServico(filtro: Pick<Servico, "id">): Promise<boolean>;
}
