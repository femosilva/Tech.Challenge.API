import { describe, expect, it } from 'bun:test';
import { ValueObject } from '@domain/core/value-object';

type Props = { texto: string; momento: Date; interno?: Interno };

class Interno extends ValueObject<{ n: number }> {
  static de(n: number) {
    return new Interno({ n });
  }
}

class Exemplo extends ValueObject<Props> {
  static de(props: Props) {
    return new Exemplo(props);
  }
}

class Outro extends ValueObject<Props> {
  static de(props: Props) {
    return new Outro(props);
  }
}

const momento = new Date(2026, 0, 1);

describe('ValueObject', () => {
  it('é igual quando todos os valores são iguais, mesmo sendo instâncias diferentes', () => {
    expect(Exemplo.de({ texto: 'a', momento }).equals(Exemplo.de({ texto: 'a', momento }))).toBe(true);
  });

  it('compara datas pelo instante, e não pela referência', () => {
    const outraData = new Date(momento.getTime());
    expect(Exemplo.de({ texto: 'a', momento }).equals(Exemplo.de({ texto: 'a', momento: outraData }))).toBe(true);
    expect(Exemplo.de({ texto: 'a', momento }).equals(Exemplo.de({ texto: 'a', momento: new Date(2027, 0, 1) }))).toBe(false);
  });

  it('compara VOs aninhados por valor', () => {
    const a = Exemplo.de({ texto: 'a', momento, interno: Interno.de(1) });
    expect(a.equals(Exemplo.de({ texto: 'a', momento, interno: Interno.de(1) }))).toBe(true);
    expect(a.equals(Exemplo.de({ texto: 'a', momento, interno: Interno.de(2) }))).toBe(false);
  });

  it('é diferente quando algum valor muda', () => {
    expect(Exemplo.de({ texto: 'a', momento }).equals(Exemplo.de({ texto: 'b', momento }))).toBe(false);
  });

  it('é diferente de outra classe, mesmo com os mesmos valores, e de undefined', () => {
    expect(Exemplo.de({ texto: 'a', momento }).equals(Outro.de({ texto: 'a', momento }) as never)).toBe(false);
    expect(Exemplo.de({ texto: 'a', momento }).equals(undefined)).toBe(false);
  });

  it('é imutável: as props ficam congeladas', () => {
    const vo = Exemplo.de({ texto: 'a', momento });
    expect(() => {
      (vo as unknown as { props: { texto: string } }).props.texto = 'b';
    }).toThrow();
  });
});
