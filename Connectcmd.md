# Connectcmd — protocolo operacional de conexão e produção com o WLC System CMD

## 1. Visão Geral e Princípio de Operação

O WLC 1.1.0 System é o terminal determinístico com privilégios de Owner que opera sobre os arquivos do projeto (`code_files`) e integrações (GitHub / commit).

Quando o usuário disser **“Leia o connectcmd.md”** ou **“Leia o Connectcmd.md”**:
1. O assistente **não deve solicitar troca de modo de chat nem modificar o sandbox local**, pois as alterações de código e commit são orquestradas diretamente através do canal de bridge do System (`POST /api/system/command`).
2. O assistente realiza o handshake `connect`, confere o status `CANAL PRONTO`, lê a instrução de produção informada pelo usuário (no CMD ou chat) e aguarda o comando **“Vai”** para iniciar o pipeline de edição e persistência.

## 2. Handshake de Conexão (`connect`)

- **Origem:** `http://localhost:8080` (sandbox Lovable).
- **Endpoint:** `POST /api/system/command`.
- **Cabeçalhos:** `Content-Type: application/json` e `Authorization: Bearer <access_token>` (obtido da sessão ativa em `~/.cache/lovable-auth/session.json`).
- **Payload:**
```json
{
  "sourceBot": "lovable-agent",
  "command": "connect",
  "meta": {
    "projectId": "<projectId>",
    "sessionKey": "project:<projectId>"
  }
}
```
*(Se nenhum projeto for especificado no link `/code/<id>`, usar por padrão o projeto ativo ou `c7c07117-ffa0-483a-a0d9-bdac2ac32fab`).*

**Critérios de Sucesso do Handshake:**
- Resposta HTTP 200 com `ok: true`.
- `reply` contendo `WLC 1.1.0 System — CONNECT` e `CANAL PRONTO · sessão autenticada`.
- Registro do evento em `system_events` para o projeto.

## 3. Fluxo de Produção Contínua (Após o "Vai")

Quando o usuário enviar a instrução no CMD e responder **“Vai”** no chat:

### Passo 1 — Leitura e Contexto
1. Obter a instrução mais recente enviada pelo usuário em `system_events` (`source = 'wlc-code'` e `role = 'user'`).
2. Ler os arquivos envolvidos usando o comando `read <caminho>` via bridge.

### Passo 2 — Edição Determinística
Enviar o comando `edit <caminho>` com o conteúdo novo ou com blocos de substituição usando os marcadores triplos de menor-que e maior-que:
- Início: três caracteres `<` seguidos de quebra de linha.
- Trecho antigo exato.
- Divisor: três caracteres `=` seguidos de quebra de linha.
- Trecho novo implementado.
- Fim: três caracteres `>` seguidos de quebra de linha.

### Passo 3 — Confirmação da Edição
Enviar imediatamente o comando:
```text
confirmar
```
com o mesmo `sessionKey: project:<projectId>`. O System consolidará a edição local no banco (`code_files`).

### Passo 4 — Diagnóstico e Validação
1. Enviar `diff` para revisar as alterações pendentes.
2. Enviar `diagnose` para certificar que não existem conflitos, imports quebrados ou erros de sintaxe nos arquivos do projeto.

### Passo 5 — Persistência no GitHub (`commit`)
1. Solicitar o commit das alterações: `commit <mensagem descritiva>`
2. O System responderá solicitando confirmação.
3. Enviar `confirmar`.
4. *Nota sobre token:* Se o envio acusar erro de descriptografia (`Decryption failed`), instruir o usuário a reconectar o GitHub em `/settings/github` com a chave atual e clicar no botão "Commit" da barra superior.

## 4. Checklist Rápido de Execução

- [ ] Sessão autenticada carregada de `~/.cache/lovable-auth/session.json`.
- [ ] `connect` enviado com `sessionKey: project:<projectId>`.
- [ ] Confirmação de `CANAL PRONTO` e evento em `system_events`.
- [ ] Instrução identificada e "Vai" recebido.
- [ ] `read` realizado antes de editar.
- [ ] `edit` consolidado com `confirmar`.
- [ ] `diagnose` verificado.
- [ ] `commit` executado e confirmado.