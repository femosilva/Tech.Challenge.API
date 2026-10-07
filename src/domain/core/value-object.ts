export abstract class ValueObject<Props extends Record<string, unknown>> {
    protected constructor(protected readonly props: Readonly<Props>) {
        Object.freeze(this.props);
    }

    equals(outro?: ValueObject<Props>): boolean {
        if (!outro || outro.constructor !== this.constructor) return false;
        return Object.keys(this.props).every((chave) =>
            Object.is(this.props[chave], outro.props[chave]),
        );
    }
}
