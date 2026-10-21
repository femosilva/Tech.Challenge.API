import { beforeEach, describe, expect, test } from 'bun:test';
import { ConflitoError, NaoEncontradoError } from '@application/core/erros';
import { RemoverPeca } from '@application/estoque/remover-peca.use-case';
import { Peca } from '@domain/estoque/peca.aggregate';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import { OrdemServicoConsultasEmMemoria } from '../doubles/consultas-em-memoria';
import { OrdemServicoRepositorioEmMemoria, PecaRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';

describe('RemoverPeca', () => {
  let pecas: PecaRepositorioEmMemoria;
  let ordens: OrdemServicoRepositorioEmMemoria;
  let remover: RemoverPeca;
  let peca: Peca;

  beforeEach(async () => {
    pecas = new PecaRepositorioEmMemoria();
    ordens = new OrdemServicoRepositorioEmMemoria();
    remover = new RemoverPeca(pecas, new OrdemServicoConsultasEmMemoria(ordens));
    peca = Peca.cadastrar({ codigo: 'FO-01', nome: 'Filtro de óleo', preco: Dinheiro.deCentavos(3500) });
    await pecas.salvar(peca);
  });

  const abrirOsComPeca = async (pecaId: string) => {
    const os = OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' });
    os.iniciarDiagnostico();
    os.incluirPeca({ pecaId, quantidade: Quantidade.de(1), precoUnitario: Dinheiro.deCentavos(3500) });
    await ordens.salvar(os);
  };

  test('remove peça nunca usada', async () => {
    await remover.executar({ id: peca.id });
    expect(await pecas.buscarPorId({ id: peca.id })).toBeNull();
  });

  test('peça inexistente vira NaoEncontradoError', async () => {
    await expect(remover.executar({ id: 'nao-existe' })).rejects.toBeInstanceOf(NaoEncontradoError);
  });

  test('recusa remover peça já usada em alguma OS', async () => {
    await abrirOsComPeca(peca.id);

    const tentativa = remover.executar({ id: peca.id });
    await expect(tentativa).rejects.toBeInstanceOf(ConflitoError);
    await expect(tentativa).rejects.toThrow('Peça já foi utilizada em ordens de serviço');
    expect(await pecas.buscarPorId({ id: peca.id })).not.toBeNull();
  });

  test('OS com outra peça não impede a remoção', async () => {
    await abrirOsComPeca('outra-peca');
    await remover.executar({ id: peca.id });
    expect(await pecas.buscarPorId({ id: peca.id })).toBeNull();
  });
});
