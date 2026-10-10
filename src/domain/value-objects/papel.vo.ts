export const PAPEIS = ['ATENDENTE', 'MECANICO', 'ADMINISTRADOR'] as const;

export type Papel = (typeof PAPEIS)[number];

export const ehPapel = (valor: string): valor is Papel =>
  (PAPEIS as readonly string[]).includes(valor);
