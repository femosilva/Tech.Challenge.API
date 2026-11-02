# Linguagem Ubíqua e glossário

Termos do domínio da oficina mecânica, usados do mesmo jeito na conversa, nos diagramas do Miro, na API e no código.
Os nomes da coluna "No código" são os do repositório (`src/domain` e `src/application`).

Quadros do Miro que usam estes termos: 1 a 3 (Event Storming), 4 (Bounded Contexts), 5 (ciclo de vida da OS),
6 (modelo de domínio), 7 (regras de transição) e 8 (agregados e invariantes).

## Contextos

| Contexto | Papel no sistema | Agregados |
|---|---|---|
| Ordem de Serviço | Domínio central: do recebimento à entrega do veículo | `OrdemServico` |
| Cadastro | Suporte: quem é o cliente e qual é o veículo | `Cliente`, `Veiculo` |
| Catálogo de Serviços | Suporte: serviços oferecidos e preço base | `Servico` |
| Estoque | Suporte: peças e insumos com saldo | `Peca` |
| Identidade e Acesso | Genérico: usuários da equipe e papéis | `Usuario` |

## Glossário

| Termo | Definição | No código | Contexto |
|---|---|---|---|
| Ordem de Serviço (OS) | Registro do atendimento de um veículo, do recebimento até a entrega | `OrdemServico` | Ordem de Serviço |
| Cliente | Pessoa física ou jurídica identificada por CPF ou CNPJ | `Cliente` | Cadastro |
| CPF ou CNPJ | Documento do cliente. Aceita máscara, e o CNPJ pode ser alfanumérico | `CpfCnpj` | Cadastro |
| Veículo | Automóvel do cliente, identificado pela placa | `Veiculo` | Cadastro |
| Placa | Identificador do veículo, no padrão antigo ou Mercosul | `Placa` | Cadastro |
| Serviço | Trabalho oferecido pela oficina, com preço base | `Servico` | Catálogo de Serviços |
| Peça | Item de reposição usado no reparo, com saldo em estoque | `Peca` | Estoque |
| Insumo | Material consumido no serviço, como óleo. Tratado como peça | `Peca` | Estoque |
| Saldo | Quantidade disponível de uma peça em estoque. Nunca fica negativo | `Peca.saldo` | Estoque |
| Reposição | Entrada de unidades no estoque | `Peca.repor` | Estoque |
| Baixa de estoque | Redução do saldo quando o cliente aprova o orçamento e a OS entra em execução | `Peca.darBaixa` | Estoque |
| Item de serviço | Serviço incluído na OS, com o preço copiado no momento da inclusão | `ItemServico` | Ordem de Serviço |
| Item de peça | Peça ou insumo incluído na OS, com quantidade e preço copiado | `ItemPeca` | Ordem de Serviço |
| Diagnóstico | Avaliação do mecânico que define os serviços e peças necessários | `OrdemServico.iniciarDiagnostico` | Ordem de Serviço |
| Orçamento | Total dos serviços e peças da OS, gerado e enviado ao cliente, que o aprova ou rejeita (decisão pendente, aprovada ou rejeitada) | `Orcamento` | Ordem de Serviço |
| Aprovação e rejeição | Decisão do cliente sobre o orçamento | `aprovarOrcamento`, `rejeitarOrcamento` | Ordem de Serviço |
| Status da OS | Etapa do ciclo de vida: Recebida, Em diagnóstico, Aguardando aprovação, Em execução, Finalizada ou Entregue | `StatusOS` | Ordem de Serviço |
| Transição | Mudança permitida de um status para outro. Qualquer outra é recusada | `StatusOS.podeIrPara` | Ordem de Serviço |
| Histórico de status | Registro de cada mudança de status, com data e hora | `RegistroStatus` | Ordem de Serviço |
| Execução | Período entre o início do trabalho (aprovação do orçamento) e a finalização da OS | `inicioExecucao`, `fimExecucao` | Ordem de Serviço |
| Tempo médio de execução | Média da duração das execuções das OS finalizadas, em milissegundos | `ObterTempoMedioExecucao` | Ordem de Serviço |
| Atendente, Mecânico, Administrador | Papéis da equipe: recepção, execução técnica e gestão | `Papel` | Identidade e Acesso |
| Cliente (como ator) | Acompanha a OS e decide o orçamento sem login, com o id da OS e o CPF ou CNPJ | rotas `/cliente/ordens-servico` | Ordem de Serviço |

## Status da OS e transições

| De | Para | Ação |
|---|---|---|
| Recebida | Em diagnóstico | Iniciar diagnóstico |
| Em diagnóstico | Aguardando aprovação | Enviar orçamento (gera e envia) |
| Aguardando aprovação | Em execução | Aprovar orçamento (baixa o estoque na mesma transação) |
| Aguardando aprovação | Em diagnóstico | Rejeitar orçamento |
| Em execução | Finalizada | Finalizar serviço |
| Finalizada | Entregue | Entregar veículo |

Serviços e peças só podem ser incluídos em Recebida ou Em diagnóstico. Incluir um item descarta o orçamento atual.

## Eventos de domínio

| Agregado | Eventos |
|---|---|
| `OrdemServico` | `OSAberta`, `DiagnosticoIniciado`, `ServicoIncluido`, `PecaIncluida`, `OrcamentoGerado`, `OrcamentoEnviado`, `OrcamentoAprovado`, `OrcamentoRejeitado`, `ExecucaoIniciada`, `OSFinalizada`, `VeiculoEntregue` |
| `Peca` | `PecaCadastrada`, `EstoqueReposto`, `EstoqueBaixado` |
| `Cliente` | `ClienteCadastrado` |
| `Veiculo` | `VeiculoRegistrado` |
| `Servico` | `ServicoCadastrado` |
| `Usuario` | nenhum |

Aprovar o orçamento emite `OrcamentoAprovado` e `ExecucaoIniciada` na OS e `EstoqueBaixado` em cada peça, tudo na mesma transação.

## Termos evitados

Não usar "pedido", "ticket", "chamado" nem "conserto". Usar sempre **Ordem de Serviço**.
Também não usar "cancelar OS": rejeitar o orçamento devolve a OS para Em diagnóstico.
