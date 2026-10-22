import { CadastrarCliente, ListarClientes, ObterCliente, RemoverCliente, RenomearCliente } from '@application/cadastro/cliente';
import {
  AtualizarVeiculo,
  CadastrarVeiculo,
  ListarVeiculos,
  ListarVeiculosDoCliente,
  ObterVeiculo,
  RemoverVeiculo,
} from '@application/cadastro/veiculo';
import {
  AtualizarServico,
  CadastrarServico,
  ListarServicos,
  ObterServico,
  RemoverServico,
} from '@application/catalogo';
import {
  AtualizarPeca,
  CadastrarPeca,
  ListarPecas,
  ObterPeca,
  RemoverPeca,
  ReporEstoque,
} from '@application/estoque';
import { Autenticar } from '@application/identidade';
import {
  ConsultarAndamento,
  DetalharOrdemServico,
  EntregarVeiculo,
  FinalizarServico,
  ListarOrdensServico,
  ObterTempoMedioExecucao,
} from '@application/ordem-servico/acompanhamento';
import {
  AbrirOS,
  AprovarOrcamento,
  EnviarOrcamento,
  IncluirPeca,
  IncluirServico,
  IniciarDiagnostico,
  RejeitarOrcamento,
} from '@application/ordem-servico/criacao';
import { BunHashSenhaAdapter, JwtProvedorTokenAdapter } from '@infrastructure/auth';
import { LogPublicadorEventosAdapter } from '@infrastructure/events';
import { criarPrismaClient, UnitOfWorkAdapter } from '@infrastructure/persistence';
import { ClienteConsultasAdapter, ClienteRepositoryAdapter } from '@infrastructure/persistence/cadastro/cliente';
import { VeiculoConsultasAdapter, VeiculoRepositoryAdapter } from '@infrastructure/persistence/cadastro/veiculo';
import { ServicoConsultasAdapter, ServicoRepositoryAdapter } from '@infrastructure/persistence/catalogo';
import { PecaConsultasAdapter, PecaRepositoryAdapter } from '@infrastructure/persistence/estoque';
import { UsuarioRepositoryAdapter } from '@infrastructure/persistence/identidade';
import { OrdemServicoConsultasAdapter, OrdemServicoRepositoryAdapter } from '@infrastructure/persistence/ordem-servico';
import type { ConfigAmbiente } from './config-ambiente';

/**
 * Único lugar que conhece a Infrastructure: cria os adapters e entrega os casos de uso prontos.
 * Quem chama é dono do `prisma` devolvido (é ele que dá o `$disconnect` ao encerrar).
 */
export function compor({ databaseUrl, jwt }: Pick<ConfigAmbiente, 'databaseUrl' | 'jwt'>) {
  const prisma = criarPrismaClient(databaseUrl);

  const clientes = new ClienteRepositoryAdapter(prisma);
  const veiculos = new VeiculoRepositoryAdapter(prisma);
  const servicos = new ServicoRepositoryAdapter(prisma);
  const pecas = new PecaRepositoryAdapter(prisma);
  const usuarios = new UsuarioRepositoryAdapter(prisma);
  const ordens = new OrdemServicoRepositoryAdapter(prisma);

  const clientesC = new ClienteConsultasAdapter(prisma);
  const veiculosC = new VeiculoConsultasAdapter(prisma);
  const servicosC = new ServicoConsultasAdapter(prisma);
  const pecasC = new PecaConsultasAdapter(prisma);
  const ordensC = new OrdemServicoConsultasAdapter(prisma);

  const uow = new UnitOfWorkAdapter(prisma);
  const hash = new BunHashSenhaAdapter();
  const tokens = new JwtProvedorTokenAdapter(jwt);
  const eventos = new LogPublicadorEventosAdapter();

  const casos = {
    // cadastro
    cadastrarCliente: new CadastrarCliente(clientes, eventos),
    renomearCliente: new RenomearCliente(clientes, eventos),
    listarClientes: new ListarClientes(clientesC),
    obterCliente: new ObterCliente(clientesC),
    removerCliente: new RemoverCliente(clientes, veiculosC, ordensC),
    cadastrarVeiculo: new CadastrarVeiculo(veiculos, clientes, eventos),
    atualizarVeiculo: new AtualizarVeiculo(veiculos, eventos),
    listarVeiculos: new ListarVeiculos(veiculosC),
    obterVeiculo: new ObterVeiculo(veiculosC),
    listarVeiculosDoCliente: new ListarVeiculosDoCliente(clientesC, veiculosC),
    removerVeiculo: new RemoverVeiculo(veiculos, ordensC),
    // catálogo e estoque
    cadastrarServico: new CadastrarServico(servicos, eventos),
    atualizarServico: new AtualizarServico(servicos, eventos),
    listarServicos: new ListarServicos(servicosC),
    obterServico: new ObterServico(servicosC),
    removerServico: new RemoverServico(servicos, ordensC),
    cadastrarPeca: new CadastrarPeca(pecas, eventos),
    atualizarPeca: new AtualizarPeca(pecas, eventos),
    listarPecas: new ListarPecas(pecasC),
    obterPeca: new ObterPeca(pecasC),
    removerPeca: new RemoverPeca(pecas, ordensC),
    reporEstoque: new ReporEstoque(pecas, eventos),
    // ordem de serviço
    abrirOS: new AbrirOS(clientes, veiculos, ordens, eventos),
    iniciarDiagnostico: new IniciarDiagnostico(ordens, eventos),
    incluirServico: new IncluirServico(ordens, servicos, eventos),
    incluirPeca: new IncluirPeca(ordens, pecas, eventos),
    enviarOrcamento: new EnviarOrcamento(ordens, eventos),
    aprovarOrcamento: new AprovarOrcamento(uow, eventos),
    rejeitarOrcamento: new RejeitarOrcamento(clientes, ordens, eventos),
    finalizarServico: new FinalizarServico(ordens, eventos),
    entregarVeiculo: new EntregarVeiculo(ordens, eventos),
    listarOrdensServico: new ListarOrdensServico(ordensC),
    detalharOrdemServico: new DetalharOrdemServico(ordensC),
    consultarAndamento: new ConsultarAndamento(ordensC, clientesC),
    obterTempoMedioExecucao: new ObterTempoMedioExecucao(ordensC),
    // identidade
    autenticar: new Autenticar(usuarios, hash, tokens),
  };

  return { prisma, casos };
}
