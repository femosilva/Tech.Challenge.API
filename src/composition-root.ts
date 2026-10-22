import { CadastrarCliente } from '@application/cadastro/cliente/cadastrar-cliente.use-case';
import { ListarClientes } from '@application/cadastro/cliente/listar-clientes.use-case';
import { ObterCliente } from '@application/cadastro/cliente/obter-cliente.use-case';
import { RemoverCliente } from '@application/cadastro/cliente/remover-cliente.use-case';
import { RenomearCliente } from '@application/cadastro/cliente/renomear-cliente.use-case';
import { AtualizarVeiculo } from '@application/cadastro/veiculo/atualizar-veiculo.use-case';
import { CadastrarVeiculo } from '@application/cadastro/veiculo/cadastrar-veiculo.use-case';
import { ListarVeiculosDoCliente } from '@application/cadastro/veiculo/listar-veiculos-do-cliente.use-case';
import { ListarVeiculos } from '@application/cadastro/veiculo/listar-veiculos.use-case';
import { ObterVeiculo } from '@application/cadastro/veiculo/obter-veiculo.use-case';
import { RemoverVeiculo } from '@application/cadastro/veiculo/remover-veiculo.use-case';
import { AtualizarServico } from '@application/catalogo/atualizar-servico.use-case';
import { CadastrarServico } from '@application/catalogo/cadastrar-servico.use-case';
import { ListarServicos } from '@application/catalogo/listar-servicos.use-case';
import { ObterServico } from '@application/catalogo/obter-servico.use-case';
import { RemoverServico } from '@application/catalogo/remover-servico.use-case';
import { AtualizarPeca } from '@application/estoque/atualizar-peca.use-case';
import { CadastrarPeca } from '@application/estoque/cadastrar-peca.use-case';
import { ListarPecas } from '@application/estoque/listar-pecas.use-case';
import { ObterPeca } from '@application/estoque/obter-peca.use-case';
import { RemoverPeca } from '@application/estoque/remover-peca.use-case';
import { ReporEstoque } from '@application/estoque/repor-estoque.use-case';
import { Autenticar } from '@application/identidade/autenticar.use-case';
import { ConsultarAndamento } from '@application/ordem-servico/acompanhamento/consultar-andamento.use-case';
import { DetalharOrdemServico } from '@application/ordem-servico/acompanhamento/detalhar-ordem-servico.use-case';
import { EntregarVeiculo } from '@application/ordem-servico/acompanhamento/entregar-veiculo.use-case';
import { FinalizarServico } from '@application/ordem-servico/acompanhamento/finalizar-servico.use-case';
import { ListarOrdensServico } from '@application/ordem-servico/acompanhamento/listar-ordens-servico.use-case';
import { ObterTempoMedioExecucao } from '@application/ordem-servico/acompanhamento/obter-tempo-medio-execucao.use-case';
import { AbrirOS } from '@application/ordem-servico/criacao/abrir-os.use-case';
import { AprovarOrcamento } from '@application/ordem-servico/criacao/aprovar-orcamento.use-case';
import { EnviarOrcamento } from '@application/ordem-servico/criacao/enviar-orcamento.use-case';
import { IncluirPeca } from '@application/ordem-servico/criacao/incluir-peca.use-case';
import { IncluirServico } from '@application/ordem-servico/criacao/incluir-servico.use-case';
import { IniciarDiagnostico } from '@application/ordem-servico/criacao/iniciar-diagnostico.use-case';
import { RejeitarOrcamento } from '@application/ordem-servico/criacao/rejeitar-orcamento.use-case';
import { BunHashSenhaAdapter } from '@infrastructure/auth/bun-hash-senha.adapter';
import { JwtProvedorTokenAdapter } from '@infrastructure/auth/jwt-provedor-token.adapter';
import { LogPublicadorEventosAdapter } from '@infrastructure/events/log-publicador-eventos.adapter';
import { ClienteConsultasAdapter } from '@infrastructure/persistence/cadastro/cliente/cliente-consultas.adapter';
import { ClienteRepositoryAdapter } from '@infrastructure/persistence/cadastro/cliente/cliente-repository.adapter';
import { VeiculoConsultasAdapter } from '@infrastructure/persistence/cadastro/veiculo/veiculo-consultas.adapter';
import { VeiculoRepositoryAdapter } from '@infrastructure/persistence/cadastro/veiculo/veiculo-repository.adapter';
import { ServicoConsultasAdapter } from '@infrastructure/persistence/catalogo/servico-consultas.adapter';
import { ServicoRepositoryAdapter } from '@infrastructure/persistence/catalogo/servico-repository.adapter';
import { PecaConsultasAdapter } from '@infrastructure/persistence/estoque/peca-consultas.adapter';
import { PecaRepositoryAdapter } from '@infrastructure/persistence/estoque/peca-repository.adapter';
import { UsuarioRepositoryAdapter } from '@infrastructure/persistence/identidade/usuario-repository.adapter';
import { OrdemServicoConsultasAdapter } from '@infrastructure/persistence/ordem-servico/ordem-servico-consultas.adapter';
import { OrdemServicoRepositoryAdapter } from '@infrastructure/persistence/ordem-servico/ordem-servico-repository.adapter';
import { criarPrismaClient } from '@infrastructure/persistence/prisma-client';
import { UnitOfWorkAdapter } from '@infrastructure/persistence/unit-of-work.adapter';
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
