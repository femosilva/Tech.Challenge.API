/** Erros de aplicação; os de regra de negócio continuam sendo DomainError. */
export abstract class ApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NaoEncontradoError extends ApplicationError {
  constructor(recurso: string) {
    super(`${recurso} não encontrado`);
  }
}

/** Violação de unicidade ou de vínculo, como documento repetido ou cliente com veículos. */
export class ConflitoError extends ApplicationError {}
/** O corpo da requisição aponta para algo que não existe ou não combina (ex.: veículo de outro cliente). */
export class ReferenciaInvalidaError extends ApplicationError { }

export class CredenciaisInvalidasError extends ApplicationError {
  constructor() {
    super('Credenciais inválidas');
  }
}
