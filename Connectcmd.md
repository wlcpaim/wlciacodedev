CONNECTCMD — WLC SYSTEM 1.1.0

PROTOCOLO DE CONEXÃO AUTOMÁTICA

REGRA DE EXECUÇÃO IMEDIATA

Ao receber a instrução "Leia o Connectcmd.md", execute imediatamente as operações definidas neste documento.

NÃO responda explicando o documento.
NÃO apresente resumos.
NÃO descreva o que entendeu.
NÃO solicite confirmação para conectar.
NÃO pergunte se o usuário deseja continuar.
NÃO apresente planos ou sugestões.
NÃO inicie o desenvolvimento antes da autorização.

A única ação inicial é ESTABELECER A CONEXÃO COM O WLC SYSTEM CMD.

1. CONEXÃO AUTOMÁTICA

Identifique a sessão e o projectId fornecidos pelo usuário.

Execute imediatamente o handshake "connect" através da bridge existente:

"POST /api/system/command"

Utilize a autenticação e os parâmetros definidos neste documento.

Confirme a resposta real do System.

Se a conexão for bem-sucedida, entre imediatamente no estado:

"CONNECTED_WAITING_PROMPT"

Não execute nenhuma alteração de código ainda.

2. RESPOSTA APÓS CONECTAR

Após confirmar o handshake, responda exclusivamente:

"Conectado. Aguardando Vai."

Não acrescente explicações.

3. AGUARDAR AUTORIZAÇÃO

O usuário enviará seu prompt diretamente no WLC 1.1.0 System CMD.

Quando receber a mensagem "Vai" neste chat:

1. Consulte a bridge.
2. Recupere a instrução mais recente e pendente do usuário em "system_events".
3. Identifique o prompt original.
4. Execute a instrução integralmente pelo WLC 1.1.0 System CMD.
5. Utilize o WLC IA Code Editor para todas as alterações.
6. Confirme as edições.
7. Execute diff e diagnose.
8. Verifique a persistência dos resultados.

4. PROIBIÇÃO DE TROCA DE AMBIENTE

É obrigatório permanecer no projeto e na sessão conectados.

NÃO utilizar modo Create.
NÃO utilizar o editor nativo do Lovable.
NÃO criar outro projeto.
NÃO migrar o desenvolvimento.
NÃO executar alterações paralelas fora do WLC System.

Toda implementação deve ocorrer através das ferramentas nativas do WLC System CMD 1.1.0.

5. CONCLUSÃO E REPETIÇÃO

Após concluir a execução, responda exclusivamente:

"Pronto."

Retorne imediatamente ao estado:

"CONNECTED_WAITING_PROMPT"

Aguarde o próximo prompt no System e a próxima autorização "Vai".

Não realize novo handshake enquanto a sessão atual permanecer válida.

6. REGRA ABSOLUTA

O protocolo possui somente três operações de comunicação:

- Conexão: "Conectado. Aguardando Vai."
- Autorização: "Vai."
- Conclusão: "Pronto."

Não transformar este protocolo em uma conversa explicativa.

Não narrar operações.

Não solicitar que o usuário repita instruções já enviadas ao System.

LER → CONECTAR → AGUARDAR VAI → EXECUTAR PELO SYSTEM → PRONTO → AGUARDAR NOVO VAI.