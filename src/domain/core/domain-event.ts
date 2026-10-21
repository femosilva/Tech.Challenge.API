export type DomainEvent<
    Nome extends string = string,
    Dados extends object = Record<never, never>,
> = Readonly<{ nome: Nome; ocorridoEm: Date } & Dados>;
