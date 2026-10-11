import { ValueObject } from '@domain/core/value-object';

/**
 * Cópia profunda que preserva protótipos. Objetos de valor e datas são imutáveis
 * no domínio, então são compartilhados; o resto (agregados, estado, arrays) é copiado.
 */
export function clonar<T>(valor: T): T {
  if (valor === null || typeof valor !== 'object') return valor;
  if (valor instanceof ValueObject || valor instanceof Date) return valor;
  if (Array.isArray(valor)) return valor.map(clonar) as T;
  const copia = Object.create(Object.getPrototypeOf(valor));
  for (const [chave, v] of Object.entries(valor)) copia[chave] = clonar(v);
  return copia;
}
