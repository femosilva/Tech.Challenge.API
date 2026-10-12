import { beforeEach, describe, expect, test } from 'bun:test';
import { RemoverServico } from '@application/catalogo/remover-servico.use-case';
import { ConflitoError, NaoEncontradoError } from '@application/core/erros';
import { Servico } from '@domain/catalogo/servico.aggregate';
import { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { OrdemServicoConsultasEmMemoria } from '../doubles/consultas-em-memoria';
import { OrdemServicoRepositorioEmMemoria, ServicoRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';

describe('RemoverServico', () => {
  let servicos: ServicoRepositorioEmMemoria;
  let ordens: OrdemServicoRepositorioEmMemoria;
  let remover: RemoverServico;
  let servico: Servico;

  beforeEach(async () => {
    servicos = new ServicoRepositorioEmMemoria();
    ordens = new OrdemServicoRepositorioEmMemoria();
    remover = new RemoverServico(servicos, new OrdemServicoConsultasEmMemoria(ordens));
    servico = Servico.cadastrar({ nome: 'Alinhamento', preco: Dinheiro.deCentavos(8000) });
    await servicos.salvar(servico);
  });

  const abrirOsComServico = async (servicoId: string) => {
    const os = OrdemServico.abrir({ clienteId: 'c1', veiculoId: 'v1' });
    os.iniciarDiagnostico();
    os.incluirServico({ servicoId, precoUnitario: Dinheiro.deCentavos(8000) });
    await ordens.salvar(os);
  };

  test('remove serviço nunca usado', async () => {
    await remover.executar({ id: servico.id });
    expect(await servicos.buscarPorId({ id: servico.id })).toBeNull();
  });

  test('serviço inexistente vira NaoEncontradoError', async () => {
    await expect(remover.executar({ id: 'nao-existe' })).rejects.toBeInstanceOf(NaoEncontradoError);
  });

  test('recusa remover serviço já usado em alguma OS', async () => {
    await abrirOsComServico(servico.id);

    const tentativa = remover.executar({ id: servico.id });
    await expect(tentativa).rejects.toBeInstanceOf(ConflitoError);
    await expect(tentativa).rejects.toThrow('Serviço já foi utilizado em ordens de serviço');
    expect(await servicos.buscarPorId({ id: servico.id })).not.toBeNull();
  });

  test('OS com outro serviço não impede a remoção', async () => {
    await abrirOsComServico('outro-servico');
    await remover.executar({ id: servico.id });
    expect(await servicos.buscarPorId({ id: servico.id })).toBeNull();
  });
});
