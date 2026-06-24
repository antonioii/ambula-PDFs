# Gerador Ambulatorial

Aplicativo desktop em **Electron + Node.js** para gerar um lote PDF ambulatorial a partir de templates locais. O lote pode ser salvo no computador, enviado para impressão pelo diálogo do sistema ou enviado por Gmail API/OAuth.

O sistema é local/offline-first para preenchimento e geração documental. Ele não é prontuário eletrônico completo, não é prescrição eletrônica validada nacionalmente, não faz assinatura digital e não substitui assinatura manual quando exigida.

## Requisitos

- Node.js 20 ou superior.
- npm.
- Sistema operacional com suporte ao Electron.
- Conta Google/Gmail e cliente OAuth próprio se for usar envio por e-mail.

## Instalação

Baixe ou clone este repositório e, dentro da pasta do projeto, execute:

```bash
npm install
```

## Executar em modo desenvolvimento

```bash
npm start
```

Também é possível usar:

```bash
npm run dev
```

Não é necessário gerar `.exe` para usar esta versão.

## Testes

```bash
npm test
```

Os testes automatizados não enviam e-mail real e não imprimem documentos reais.

## Como usar

1. Abra o aplicativo com `npm start`.
2. Preencha apenas os campos que deseja carimbar no PDF.
3. Ajuste o campo de meses/cópias da prescrição, se necessário.
4. Escolha a saída:
   - **Enviar por email**;
   - **Salvar no PC**;
   - **Impressora da rede**.
5. Clique em **Transmitir**.

O botão **Transmitir** sempre gera um lote PDF atualizado a partir dos dados atuais antes de executar a ação escolhida.

Nenhum campo de identificação, evolução ou medicação é obrigatório. Campos vazios são omitidos no PDF.

## Configurar envio por Gmail

O app usa OAuth do Google. Ele não armazena senha de Gmail.

### 1. Criar credenciais no Google Cloud

No Google Cloud Console:

1. Crie ou selecione um projeto.
2. Habilite a **Gmail API**.
3. Configure a tela de consentimento OAuth.
4. Crie um cliente OAuth do tipo **Aplicativo para computador**.
5. Baixe o JSON do cliente.

### 2. Criar o arquivo local de credenciais

Copie o arquivo de exemplo:

```bash
cp oauth-client.local.example.json oauth-client.local.json
```

No Windows PowerShell:

```powershell
Copy-Item oauth-client.local.example.json oauth-client.local.json
```

Depois edite `oauth-client.local.json` e substitua os placeholders pelo `client_id` e `client_secret` do seu cliente OAuth.

O app aceita o formato exportado pelo Google:

```json
{
  "installed": {
    "client_id": "SEU_CLIENT_ID.apps.googleusercontent.com",
    "client_secret": "SEU_CLIENT_SECRET"
  }
}
```

Também aceita o formato simples:

```json
{
  "client_id": "SEU_CLIENT_ID.apps.googleusercontent.com",
  "client_secret": "SEU_CLIENT_SECRET"
}
```

`oauth-client.local.json` é ignorado pelo Git e não deve ser publicado.

### 3. Conectar no aplicativo

1. Abra o app.
2. Clique na engrenagem ao lado de **Enviar por email**.
3. Informe o e-mail de destino.
4. Clique em **Conectar Gmail**.
5. Autorize no navegador.
6. Use **Enviar teste** antes do primeiro lote real.

Os tokens OAuth são armazenados usando o armazenamento seguro do Electron quando disponível.

## Estrutura principal

```text
src/
  config/        Configurações locais e armazenamento seguro.
  documents/     Geração e carimbo dos PDFs.
  domain/        Regras de dose, validação e nomes de arquivo.
  main/          Processo principal Electron e IPC.
  preload/       API segura exposta ao renderer.
  renderer/      Interface HTML/CSS/JS.
  transmission/  Salvamento, impressão e Gmail.
templates/       PDFs e coordenadas usadas na geração.
assets/ui/       Imagens de referência visual.
tests/           Testes automatizados.
```

## Segurança e privacidade

- Não publique `oauth-client.local.json`.
- Não publique tokens, `.env`, logs, PDFs gerados ou dados reais de pacientes.
- Não use dados reais em testes, screenshots ou issues públicas.
- O assunto do e-mail não contém dados clínicos.
- O app não deve registrar dados clínicos em logs.

Arquivos sensíveis e saídas locais já estão protegidos no `.gitignore`.

## Observações clínicas e legais

Este software apenas auxilia na geração local de documentos em PDF. A responsabilidade por conferência, impressão, assinatura, guarda e envio dos documentos é do profissional/serviço que opera o sistema.
