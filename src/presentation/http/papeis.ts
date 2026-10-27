import type { Papel } from '@domain/value-objects/papel.vo';

/** Matriz de papéis da API: quem pode o quê. O Administrador pode tudo o que a equipe pode. */
export const PODE_CONSULTAR = ['ATENDENTE', 'MECANICO', 'ADMINISTRADOR'] as const satisfies readonly Papel[];
export const PODE_CADASTRAR = ['ATENDENTE', 'ADMINISTRADOR'] as const satisfies readonly Papel[];
export const PODE_ADMINISTRAR = ['ADMINISTRADOR'] as const satisfies readonly Papel[];
