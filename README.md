# Gerador Ambulatorial Electron

Este README descreve a futura reimplementação do projeto em **Electron + Node.js**.

O projeto será reconstruído do zero a partir de `backup_original/`, mantendo o mesmo objetivo: gerar documentos ambulatoriais impressos em saúde mental a partir de templates PDF existentes.

O envio ao GitHub será feito manualmente pelo proprietário do projeto depois que a estrutura local estiver pronta.

## Objetivo

Criar um aplicativo desktop local/offline-first para:

- preencher dados de paciente, atendimento, evolução e medicações;
- gerar um PDF único de lote;
- salvar o lote no computador;
- imprimir o lote;
- em uma segunda etapa, transmitir o lote por Gmail API/OAuth.

O sistema não é prontuário eletrônico completo, não é prescrição eletrônica validada nacionalmente e não substitui assinatura manual quando exigida.

## Fonte inicial

Ao iniciar a reimplementação, a única pasta preservada poderá ser:

```text
backup_original/
```

Essa pasta deve ser usada como referência histórica, visual e documental. Ela não deve ser modificada.

Arquivos importantes esperados em `backup_original/`:

- `main.png`: referência visual da tela principal;
- `medic_field.png`: referência visual da área de medicações;
- `popup-presc.png`: referência visual do popup/painel de prescrição;
- `ficha_evolucao.pdf`: template da evolução;
- `tabela_organizar_remedios.pdf`: template da tabela de medicações;
- `remedio.pdf`: template da prescrição.

## Stack prevista

- Electron;
- Node.js;
- HTML/CSS/JavaScript no renderer;
- `pdf-lib` para geração e união de PDFs;
- `googleapis` para Gmail API/OAuth na etapa de e-mail;
- `keytar` ou equivalente seguro para tokens;
- `vitest`, `node:test` ou equivalente para testes.

## Etapas do desenvolvimento

### Etapa 1: MVP local

Primeiro objetivo: gerar o lote PDF pronto para salvar no sistema e imprimir.

Inclui:

- UI principal em Electron;
- formulário de paciente, evolução e medicações;
- tabela fixa com 10 posições de medicação;
- 5 linhas visíveis com scrollbar;
- cinco horários: Café, Almoço, Lanche, Jantar e Dormir;
- campo separado para meses/cópias da prescrição;
- geração de PDF único de lote;
- prescrição avulsa sem evolução;
- salvamento via diálogo nativo do sistema;
- impressão local/de rede ou stub seguro até validação real.

### Etapa 2: MVP e-mail

Segundo objetivo: transmitir o lote por Gmail.

Inclui:

- Gmail API via `googleapis`;
- OAuth seguro;
- armazenamento seguro de tokens;
- e-mail de destino configurável;
- engrenagem ao lado de **Enviar por email**;
- teste de envio sem dados sensíveis;
- envio do PDF único gerado pelo botão **Transmitir**.

## Botão Transmitir

O botão principal deve se chamar exatamente **Transmitir**.

Ao clicar em **Transmitir**, o app deve:

1. coletar os dados atuais da tela;
2. validar os dados;
3. gerar automaticamente o PDF único de lote;
4. executar a opção selecionada.

Opções abaixo de **Transmitir**:

- **Enviar por email**: opção default;
- **Salvar no PC**;
- **Impressora da rede**.

Quando **Salvar no PC** estiver selecionado, o comportamento deve ser simples: abrir o diálogo nativo do sistema para escolher onde salvar o PDF.

## Execução durante desenvolvimento

Durante o desenvolvimento, o app deve rodar sem empacotamento final.

Comandos esperados, conforme configuração do projeto:

```bash
npm install
npm run dev
```

ou:

```bash
npm start
```

Não gerar `.exe`, instalador, pacote ou build final sem comando explícito do proprietário do projeto.

## Regras funcionais essenciais

- Cada prescrição contém apenas uma medicação.
- Cada prescrição representa apenas um mês.
- O número de meses determina quantas páginas/cópias da prescrição serão geradas.
- A quantidade mensal é `comprimidos por dia × 30`.
- O número de meses não multiplica a quantidade mensal.
- Frações simples como `1/2` devem ser aceitas.
- `-`, vazio e `0` equivalem a zero.
- Texto inválido em horário deve bloquear a geração da prescrição.
- Nome do paciente, medicação e dados carimbados na prescrição/tabela devem estar em caixa alta.
- A evolução deve usar rótulos com hashtag e não pode ser cortada silenciosamente.

## Segurança

- Não versionar PDFs gerados, `.env`, tokens, credenciais ou logs sensíveis.
- Não armazenar senha de Gmail.
- Não usar dados reais de pacientes em testes, screenshots ou documentação.
- Não enviar e-mail real em testes automatizados.
- Não imprimir documentos reais em testes automatizados.
- Não modificar `backup_original/`.

## Documentação principal

- `AGENTS2.md`: especificação técnica para a LLM/agente que fará a reimplementação em Electron.
- `README2.md`: visão geral operacional da futura versão Electron.
- `backup_original/`: referências originais preservadas.

## GitHub

O projeto será colocado no GitHub manualmente pelo proprietário depois da preparação local.

A LLM/agente não deve tentar criar repositório remoto, fazer push, criar releases ou publicar instaladores sem pedido explícito.
