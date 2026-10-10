import { AggregateRoot } from '@domain/core/aggregate-root';
import { DomainError } from '@domain/core/domain-error';
import { ehPapel, type Papel } from '@domain/shared/value-objects/papel.vo';

type Dados = Pick<Usuario, 'email' | 'senhaHash'> & { papel: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Usuário que acessa as APIs administrativas. Não emite eventos de domínio. */
export class Usuario extends AggregateRoot<never> {
  private constructor(
    id: string,
    readonly email: string,
    readonly senhaHash: string,
    readonly papel: Papel,
  ) {
    super(id);
  }

  /** Recebe a senha já transformada em hash: o domínio nunca vê a senha em texto. */
  static criar(dados: Dados): Usuario {
    return new Usuario(
      Usuario.gerarId(),
      Usuario.emailValido(dados.email),
      Usuario.hashValido(dados.senhaHash),
      Usuario.papelValido(dados.papel),
    );
  }

  /** Reconstrói a partir da persistência. */
  static restaurar(dados: Dados & Pick<Usuario, 'id'>): Usuario {
    return new Usuario(dados.id, dados.email, dados.senhaHash, Usuario.papelValido(dados.papel));
  }

  private static emailValido(email: string): string {
    const normalizado = email?.trim().toLowerCase();
    if (!normalizado || !EMAIL.test(normalizado)) throw new DomainError('E-mail inválido');
    return normalizado;
  }

  private static hashValido(hash: string): string {
    if (!hash?.trim()) throw new DomainError('Hash de senha é obrigatório');
    return hash;
  }

  private static papelValido(papel: string): Papel {
    if (!ehPapel(papel)) throw new DomainError(`Papel inválido: ${papel}`);
    return papel;
  }
}
