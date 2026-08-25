# Cabral e Sousa - Transporte - SGTickets - Sistema de Governança de Tickets

Lovable, você é uma super especialista na área de TI e deve criar um sistema simples de gestão de tickets com o nome SGTickets - Sistema de Governança de Tickets. Esse sistema deve ter um banco de dados estruturado para a criação dos cadastros que serão descritos no texto abaixo.

 

No banco de dados deve ser criada uma tabela com o nome ControleFinanceiro que deve conter os campos DataInicial (no forma de data dd/mm/yyyy), DataFinal (no forma de data dd/mm/yyyy) e SituacaoFinanceira com as opções ATIVO e INATIVO. Essa tabela deve existir somente no banco de dados do sistema.

 

Esse sistema deve ser super intuitivo além de ter cores claras e uma interface super intuitiva de modo que torne o seu uso super agradável para os usuários.

 

Esse sistema deve ter gráficos com letras redondas e de fácil leitura.

 

Esse sistema deve conter um gráfico mostrando uma meta de 1,5 dias e contabilizando a média de dias para fechar o ticket. Para fazer esse cálculo o sistema deve considerar somente os horários definidos no cadastro de expediente.

 

Esse cadastro conterá os dias e horários em que os Atendentes fazem atendimento. Esses dias e horários devem ser configurados por Atendentes.

 

Esse sistema deve conter um gráfico, por Atendente, mostrando a média de dias que o Atendente leva para fechar um ticket mostrando quem está acima e abaixo da meta. Para fazer esse cálculo o sistema deve considerar somente os horários definidos no cadastro de expediente.

 

Esse sistema deve conter um gráfico mostrando a meta de avalição dos tickets. A avaliação seguirá a métrica do NPS onde deve ser de 0 a 5 sendo 5 muito satisfeito, 4 satisfeito, 3 parcialmente satisfeito, 2 insatisfeito e 1 muito insatisfeito. Se a avaliação for menor ou igual a 3 o sistema deverá solicitar obrigatoriamente uma descrição do motivo da avaliação.

 

O usuário só poderá abrir novo ticket se não houver mais nenhum ticket a ser avaliado. Para isso o sistema deve emitir uma notificação, do tipo popup, toda vez que o usuário acessar o sistema, mostrando os tickets que precisam ser avaliados.

 

Esse sistema deve conter um gráfico, por Atendente, mostrando a média de avaliação de ticket por Atendente identificando quem está acima e quem está abaixo a meta.

 

Esse sistema deve conter um Cadastro de Administrador do sistema onde seja possível informar o nome, setor, função, e-mail, telefone de contato, nome do líder do usuário, data e hora em que o usuário foi cadastrado e status do usuário. O campo status do usuário deve conter as opções de Ativo e Inativo. Esse campo deve permitir selecionar somente uma opção. O campo data e hora em que o usuário foi cadastrado deve ser preenchimento automaticamente assim que o usuários for cadastrado. No cadastro deve ter um campo com o nome Primeiro Login. Esse campo deve conter as opções SIM e NÃO. Por padrão esse campo deve vir preenchido com SIM.

 

Esse sistema deve conter um Cadastro de Usuário onde seja possível informar o nome, setor, função, e-mail, telefone de contato, nome do líder do usuário, data e hora em que o usuário foi cadastrado, status do usuário e senha. O campo status do usuário deve conter as opções de Ativo e Inativo. Esse campo deve permitir selecionar somente uma opção. O campo data e hora em que o usuário foi cadastrado deve ser preenchimento automaticamente assim que o usuários for cadastrado. Nesse cadastro serão cadastrados usuários que podem criar tickets. No cadastro deve ter um campo com o nome Primeiro Login. Esse campo deve conter as opções SIM e NÃO. Por padrão esse campo deve vir preenchido com SIM.

 

Esse sistema deve conter um Cadastro de Serviços onde possamos cadastrar os serviços do sistema. Nesse cadastro deve ser informado o código, nome, status do serviço e senha.

 

Esse sistema deve conter um Cadastro de Formulários por Serviço onde possamos criar formulários e associá-los aos serviços cadastrados no Cadastro de Serviços.

 

Esse sistema deve conter um Cadastro de Atendentes onde seja possível informar o nome, setor, função, e-mail, telefone de contato, nome do líder do usuário, data e hora em que o Atendente foi cadastrado e status do Atendente e senha. O campo status do Atendente deve conter as opções de Ativo e Inativo. Esse campo deve permitir selecionar somente uma opção. O campo data e hora em que o usuário foi cadastrado deve ser preenchimento automaticamente assim que o usuários for cadastrado. No cadastro deve ter um campo com o nome Primeiro Login. Esse campo deve conter as opções SIM e NÃO. Por padrão esse campo deve vir preenchido com SIM.

 

Esse sistema deve conter um cadastro onde possamos associar aos Atendentes aos serviços que podem atender. Os Atendentes só poderão atender e visualizar tickets que estiverem associados a eles nesse cadastro. Esse cadastro deve ter o nome Cadastro de Atendente x Serviço.

 

Esse sistema deve criar um sistema de chat, tipo whatsapp, que será utilizado para o usuário abrir o ticket. Quando o usuário acessar essa opção o sistema deve seguir o fluxo abaixo:

 

Esse sistema deve ter um esquema de chat, parecido com o whatsapp, onde o usuário possa iniciar uma conversa.

 

Essa conversa deve seguir o fluxo abaixo:

 

1 - Quando o usuário acessar o chat o sistema deve emitir uma mensagem de boas-vindas, mencionando o nome do usuário, adotar um comportamento super carismático, utilizando emojis, e pedir para o usuário selecionar uma das opções abaixo:

 

2 - O sistema deve, logo em seguida, mostrar a lista dos serviços do Cadastro de Serviços que estão com o status de ativo. É obrigatório selecionar uma das opções da lista e o usuário só poderá selecionar uma opção da lista.

 

3 - Em seguida o sistema deve fazer uma busca no Cadastro de Formulários por Serviço e mostrar o formulário localizado para que seja preenchido pelo usuário. Caso não exista nenhum formulário o sistema deverá ir para o próximo passo.

 

4 - Em seguida o sistema deve localizar os Atendentes que estão associados a esse serviço, conforme configurado no Cadastro de Atendente x Serviço, identificar a quantidade de tickets que cada um desses Atendentes têm ativos (que não estão fechados) no momento e enviar uma mensagem para o Atendente que tiver a menor quantidade de tickets ativos (que ainda não foram fechados). Essa mensagem deve aparecer para o Atendente na tela do Atendente . Nesse momento o sistema deve registrar um ticket com todos os dados digitados pelo usuário e associá-lo a esse Atendente. Toda a conversa entre o usuários e o Atendente deve ser registrada no histórico do ticket.

 

5 - O sistema deve disponibilizar as opções de fechar o ticket para um ticket aberto.

 

6 - O sistema deve disponibilizar as opções de reabrir o ticket para um ticket fechado.

 

7 - O sistema deve disponibilizar as opções de transferir o ticket para outro Atendente somente em um ticket que estiver com o status de aberto.

 

Um ticket só pode ter dois status sendo ABERTO e FECHADO.
Esse sistema deve identificar no ticket quando o mesmo tiver sido REABERTO.

 

Esse sistema deve implementar o seguinte controle de permissão no sistema:

 

1 - O usuário cadastrado no Cadastro de Administrador do Sistema terá acesso total ao sistema.

 

2 - O usuário cadastrado no Cadastro de Usuário só poderá criar, fechar, reabrir e acompanhar seus próprios tickets.

 

3 - O usuário cadastrado no Cadastro de Atendente poderá criar tickets e atender e transferir somente os tickets que tem serviços associados ao Atendente no Cadastro de Atendente x Serviço.

 

Regra de transferência de ticket:

 

Esse sistema só poderá permitir transferir ticket para outro Atendente desde que o serviço do ticket a ser transferido esteja associado ao Atendente no Cadastro de Atendente x Serviço.

 

Esse sistema deve ter uma tela de login para que o Usuário, Atendente e Administrador possam informar o e-mail e a senha, que estão no seu cadastro, para conseguir acessar o sistema. Se no cadastro do Usuário, Atendente e Administrador o campo PRIMEIRO LOGIN for igual a SIM o sistema deverá obrigar o Usuário, Atendente e Administrador a mudar de senha. Essa nova senha deve ser gravada no cadastro o Usuário, Atendente e Administrador no campo SENHA e logo em seguida deverá selecionar a opção NÃO no campo PRIMEIRO LOGIN.

 

Esse sistema deve conter uma Tabela de Log que registra tudo que é feito no sistema. Todo login, logout, criação, edição e alteração de registros de qualquer tabela do sistema deve ser registrado na Tabela de Log. Essa tabela só pode ser acessada por usuários que estão no Cadastro de Administrador do Sistema.

 

Esse sistema deve ser completamente responsivo para ser utilizado em dispositivos de qualquer tamanho.

 

 

Mostre passo a passo os itens acima que estão sendo executados e o status de cada um até o final!

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/aaff8bfc-5400-4ceb-a7d8-2a3000471362).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
