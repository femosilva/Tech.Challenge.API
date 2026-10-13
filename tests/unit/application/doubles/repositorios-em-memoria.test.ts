import type { AggregateRoot } from '@domain/core/aggregate-root';
import type { Peca } from '@domain/estoque/peca.aggregate';
import type { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import type { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import type { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import type { Servico } from '@domain/catalogo/servico.aggregate';
import type { Usuario } from '@domain/identidade/usuario.aggregate';

import type { ServicoRepository } from '@domain/catalogo/servico.repository';
import type { PecaRepository } from '@domain/estoque/peca.repository';
import type { OrdemServicoRepository } from '@domain/ordem-servico/ordem-servico.repository';
import type { ClienteRepository } from '@domain/cadastro/cliente/cliente.repository';
import type { VeiculoRepository } from '@domain/cadastro/veiculo/veiculo.repository';
import type { UsuarioRepository } from '@domain/identidade/usuario.repository';

import { clonar } from './clonar';
/**
 * Guarda e devolve cópias, como um banco de verdade: alterar o que foi carregado
 * não muda o que está guardado até chamar salvar.
 */
export abstract class RepositorioEmMemoria<T extends AggregateRoot> {
  protected itens = new Map<string, T>();

  async buscarPorId(filtro: Pick<T, 'id'>): Promise<T | null> {
    const item = this.itens.get(filtro.id);
    return item ? clonar(item) : null;
  }

  async salvar(item: T): Promise<void> {
    const copia = clonar(item);
    copia.puxarEventos(); // eventos pendentes não são persistidos
    this.itens.set(item.id, copia);
  }

  async remover(filtro: Pick<T, 'id'>): Promise<void> {
    this.itens.delete(filtro.id);
  }

  /** Devolve a função que restaura o estado de agora. */
  snapshot(): () => void {
    const copia = new Map(this.itens);
    return () => {
      this.itens = copia;
    };
  }
  todos(): T[] {
     return [...this.itens.values()].map(clonar);
   }
  protected buscarUm(predicado: (item: T) => boolean): T | null {
    for (const item of this.itens.values()) if (predicado(item)) return clonar(item);
    return null;
  }
}

export class PecaRepositorioEmMemoria extends RepositorioEmMemoria<Peca> implements PecaRepository {
  async buscarPorCodigo(filtro: Pick<Peca, 'codigo'>): Promise<Peca | null> {
    return this.buscarUm((p) => p.codigo === filtro.codigo);
  }
}

export class OrdemServicoRepositorioEmMemoria
  extends RepositorioEmMemoria<OrdemServico>
  implements OrdemServicoRepository {}

  export class ClienteRepositorioEmMemoria
    extends RepositorioEmMemoria<Cliente>
    implements ClienteRepository
  {
    async buscarPorDocumento(filtro: Pick<Cliente, 'documento'>): Promise<Cliente | null> {
      return this.buscarUm((c) => c.documento.equals(filtro.documento));
    }
  }
  export class VeiculoRepositorioEmMemoria
    extends RepositorioEmMemoria<Veiculo>
    implements VeiculoRepository
  {
    async buscarPorPlaca(filtro: Pick<Veiculo, 'placa'>): Promise<Veiculo | null> {
      return this.buscarUm((v) => v.placa.equals(filtro.placa));
    }
  }
  export class ServicoRepositorioEmMemoria
    extends RepositorioEmMemoria<Servico>
    implements ServicoRepository {}
    export class UsuarioRepositorioEmMemoria
      extends RepositorioEmMemoria<Usuario>
      implements UsuarioRepository
    {
      async buscarPorEmail(filtro: Pick<Usuario, 'email'>): Promise<Usuario | null> {
        return this.buscarUm((u) => u.email === filtro.email);
      }
    }
