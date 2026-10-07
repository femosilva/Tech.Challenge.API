export abstract class Entity {
    protected constructor(readonly id: string) {}

    protected static gerarId(): string {
        return crypto.randomUUID();
    }

    equals(outra?: Entity): boolean {
        return (
            !!outra &&
            outra.constructor === this.constructor &&
            outra.id === this.id
        );
    }
}
