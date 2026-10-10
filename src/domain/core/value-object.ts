export abstract class ValueObject<Props extends Record<string, unknown>> {
    protected constructor(protected readonly props: Readonly<Props>) {
        Object.freeze(this.props);
    }

    equals(outro?: ValueObject<Props>): boolean {
        if (!outro || outro.constructor !== this.constructor) return false;
        return Object.keys(this.props).every((k) =>
            iguais(this.props[k], outro.props[k]),
        );
    }
}

function iguais(a: unknown, b: unknown): boolean {
    if (a instanceof ValueObject && b instanceof ValueObject)
        return a.equals(b);
    if (a instanceof Date && b instanceof Date)
        return a.getTime() === b.getTime();
    return Object.is(a, b);
}
