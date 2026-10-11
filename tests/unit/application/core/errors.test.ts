import { describe, expect, test } from 'bun:test';
import {
  ApplicationError,
  ConflitoError,
  CredenciaisInvalidasError,
  NaoEncontradoError,
} from '@application/core/erros';

describe('erros de aplicação', () => {
  test('NaoEncontradoError nomeia o recurso', () => {
    const erro = new NaoEncontradoError('Cliente');
    expect(erro.message).toBe('Cliente não encontrado');
    expect(erro.name).toBe('NaoEncontradoError');
    expect(erro).toBeInstanceOf(ApplicationError);
  });

  test('ConflitoError leva a mensagem informada', () => {
    const erro = new ConflitoError('Documento já cadastrado');
    expect(erro.message).toBe('Documento já cadastrado');
    expect(erro.name).toBe('ConflitoError');
    expect(erro).toBeInstanceOf(ApplicationError);
  });

  test('CredenciaisInvalidasError tem mensagem fixa e não revela o motivo', () => {
    const erro = new CredenciaisInvalidasError();
    expect(erro.message).toBe('Credenciais inválidas');
    expect(erro).toBeInstanceOf(ApplicationError);
  });
});
