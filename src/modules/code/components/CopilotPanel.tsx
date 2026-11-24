import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { VersionSelector } from "@/modules/versions/components/VersionSelector";
import { customVersionId, copilotHistoryKey, useSelectedVersion, PRO_SLUG, SYSTEM_SLUG } from "@/modules/versions/selected";
import { supabase } from "@/integrations/supabase/client";
import type { SystemConnection } from "@/modules/system/core/connection";
import { ArrowUp, Check, Code2, FileCode2, Loader2, Square, X, RotateCcw, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Markdown } from "@/components/chat/Markdown";
import { askCopilot, applyCopilotFile } from "../functions/copilot.functions";
import { revertProjectBackup } from "../functions/backup.functions";
import type { CopilotAnswer, CopilotChange } from "../copilot";

type Entry = {
  id: string;
  role: "user" | "model" | "commit";
  content: string;
  answer?: CopilotAnswer;
  resolved?: string[];
  commitData?: {
    sha: string;
    message: string;
    count: number;
    backupId: string | null;
    reverted?: boolean;
  };
};
type AppliedFile = { id: string; path: string; content: string; base_content: string | null; deleted: boolean; updated_at: string };

type CopilotPanelProps = {
  projectId: string; ownerId: string; activePath: string | null;
  beforeSend: () => Promise<void>; onFocus: () => void; onApplied: (file: AppliedFile) => void;
  overlay?: ReactNode;
};

export function CopilotPanel(props: CopilotPanelProps) {
  const selectedVersion = useSelectedVersion();
  const storageKey = copilotHistoryKey(props.ownerId, props.projectId, selectedVersion);
  return <VersionCopilotPanel key={storageKey} {...props} selectedVersion={selectedVersion} storageKey={storageKey} />;
}

function VersionCopilotPanel({ projectId, activePath, beforeSend, onFocus, onApplied, overlay, selectedVersion, storageKey }: CopilotPanelProps & { selectedVersion: string | null; storageKey: string }) {
  const ask = useServerFn(askCopilot);
  const apply = useServerFn(applyCopilotFile);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [connection, setConnection] = useState<SystemConnection | null>(null);
  const abort = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, busy]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const commitEntry: Entry = {
        id: crypto.randomUUID(),
        role: "commit",
        content: detail.message || "Commit realizado",
        commitData: {
          sha: detail.sha,
          message: detail.message,
          count: detail.count,
          backupId: detail.backupId,
          reverted: false,
        },
      };
      setEntries(prev => [...prev, commitEntry]);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    window.addEventListener("wlc-commit-success", handler);
    return () => window.removeEventListener("wlc-commit-success", handler);
  }, []);
  const isPro = selectedVersion === PRO_SLUG;
  const isSystem = selectedVersion === SYSTEM_SLUG;
  const versionId = customVersionId(selectedVersion);
  const copilotName = isPro ? "Copilot WLC 1.7.1" : isSystem ? "Copilot WLC 1.1.0 System" : versionId ? "Copilot WLC" : "Copilot WLC 1.5.6";

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      // Stored history is display-only; proposals are deliberately not restored as executable actions.
      if (Array.isArray(stored)) setEntries(stored.filter((e): e is Entry =>
        e !== null && typeof e === "object" && typeof e.id === "string" && typeof e.content === "string" && (e.role === "user" || e.role === "model" || e.role === "commit")
      ));
    } catch { /* Unavailable browser storage does not prevent editing. */ }
    setReady(true);
    return () => abort.current?.abort();
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(storageKey, JSON.stringify(entries.slice(-30).map(({ id, role, content, commitData }) => ({ id, role, content, commitData })))); }
    catch { /* Keep the active conversation usable if storage is full. */ }
  }, [entries, ready, storageKey]);

  // Shared project channel: commands sent by other sources (e.g. the orchestrator agent) appear here live.
  useEffect(() => {
    if (!isSystem) return;
    const channel = supabase
      .channel(`system-events-${projectId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "system_events", filter: `project_id=eq.${projectId}` }, (payload) => {
        const row = payload.new as { id: string; source: string; role: string; content: string };
        if (row.source === "wlc-code") return;
        const content = row.role === "user" ? `[${row.source}] ${row.content}` : row.content;
        setEntries(e => e.some(x => x.id === row.id) ? e : [...e, { id: row.id, role: row.role === "user" ? "user" : "model", content }]);
        window.dispatchEvent(new CustomEvent("wlc-reload-files"));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isSystem, projectId]);

  const send = async () => {
    const prompt = text.trim();
    if (!prompt || busy || applying) return;
    onFocus(); setBusy(true); setError(null);
    const controller = new AbortController(); abort.current = controller;
    const entry = { id: crypto.randomUUID(), role: "user" as const, content: prompt };
    setEntries(e => [...e, entry]); setText("");
    try {
      await beforeSend();
      if (controller.signal.aborted) return;
      if (isSystem) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Sessão expirada.");
        const response = await fetch("/api/system/command", {
          method: "POST", signal: controller.signal,
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ sourceBot: "wlc-code", command: prompt, meta: { projectId, sessionKey: `project:${projectId}` } }),
        });
        const result = await response.json() as {
          ok?: boolean;
          reply?: string;
          error?: string;
          data?: {
            connection?: SystemConnection;
            sha?: string;
            count?: number;
            backupId?: string | null;
            message?: string;
          };
        };
        if (!response.ok || !result.ok) {
          setConnection(null);
          setError(result.reply ?? result.error ?? "Falha no System."); setText(prompt); return;
        }
        setEntries(e => [...e, { id: crypto.randomUUID(), role: "model", content: result.reply ?? "" }]);
        if (result.data?.connection) setConnection(result.data.connection);
        if (result.data?.sha && result.data?.backupId) {
          window.dispatchEvent(new CustomEvent("wlc-commit-success", {
            detail: {
              sha: result.data.sha,
              message: result.data.message || prompt,
              count: result.data.count,
              backupId: result.data.backupId,
            }
          }));
        }
        window.dispatchEvent(new CustomEvent("wlc-reload-files"));
        return;
      }
      const result = await ask({ data: { projectId, message: prompt, activePath,
        history: entries.filter(e => e.role === "user" || e.role === "model").slice(-6).map(e => ({ role: e.role, content: e.content.slice(0, 2000) })),
        ...(isPro ? { pro: true } : versionId ? { versionId } : {}),
      }, signal: controller.signal });

      if (controller.signal.aborted) return;
      if (!result.ok) { setError(result.error); setText(prompt); return; }
      setEntries(e => [...e, { id: crypto.randomUUID(), role: "model", content: result.answer.summary, answer: result.answer }]);
    } catch {
      setConnection(null);
      if (!controller.signal.aborted) { setError("Não foi possível concluir. Sua mensagem foi preservada para tentar novamente."); setText(prompt); }
    } finally {
      if (abort.current === controller) { setBusy(false); abort.current = null; }
    }
  };

  const resolve = (id: string, path: string) => setEntries(e => e.map(item => item.id === id ? { ...item, resolved: [...(item.resolved ?? []), path] } : item));
  const applyChange = async (id: string, change: CopilotChange) => {
    if (applying || busy) return;
    setApplying(change.path); setError(null);
    try {
      await beforeSend();
      const result = await apply({ data: { projectId, change } });
      if (!result.ok) { setError(result.error); return; }
      onApplied(result.file); resolve(id, change.path);
    } catch { setError("Não foi possível aplicar o arquivo. Sua proposta continua disponível."); }
    finally { setApplying(null); }
  };

  const applyAll = async (entry: Entry) => {
    for (const change of entry.answer?.changes ?? []) {
      if (entry.resolved?.includes(change.path)) continue;
      await applyChange(entry.id, change);
    }
  };

  return <div className="flex h-full min-h-0 flex-col">
    <div className="relative min-h-0 flex-1">
    <div className="h-full overflow-y-auto px-4 py-6" aria-label="Conversa do Copilot WLC">
      <div className="mx-auto max-w-3xl space-y-7">
        {entries.length === 0 && <div className="py-10">
          <Code2 className="mb-4 h-8 w-8 text-primary" />
          <h1 className="font-mono text-xl font-semibold">{copilotName}</h1>
          {isPro && <p className="mt-2 text-sm text-muted-foreground">Não precisa abrir arquivos: peça telas, funções ou estruturas completas e ele encontra e edita os lugares certos.</p>}
        </div>}
        {entries.map(entry => <article key={entry.id} className="min-w-0 break-words">
          {entry.role === "commit" ? (
            <div className="rounded-lg border border-border/60 bg-card p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-md bg-muted text-primary">
                    <RotateCcw className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-sm">Commit realizado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {entry.commitData?.sha && (
                    <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                      {entry.commitData.sha.slice(0, 7)}
                    </span>
                  )}
                  {entry.commitData?.count !== undefined && (
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                      {entry.commitData.count} arq(s)
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{entry.content}</p>
              {entry.commitData?.backupId && (
                <div className="flex items-center justify-between pt-1">
                  {entry.commitData.reverted ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                      <Check className="h-3.5 w-3.5" /> Revertido com sucesso
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={revertingId === entry.id} onClick={async () => {
                      if (!entry.commitData?.backupId) return;
                      setRevertingId(entry.id);
                      try {
                        const { toast } = await import("sonner");
                        const r = await revertProjectBackup({ data: { backupId: entry.commitData.backupId } });
                        if (r.ok) {
                          toast.success("Projeto revertido para o commit com sucesso");
                          setEntries(e => e.map(item => item.id === entry.id && item.commitData ? { ...item, commitData: { ...item.commitData, reverted: true } } : item));
                          window.dispatchEvent(new CustomEvent("wlc-reload-files"));
                        } else {
                          toast.error(r.error);
                        }
                      } finally {
                        setRevertingId(null);
                      }
                    }}>
                      {revertingId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                      {revertingId === entry.id ? "Revertendo…" : "Fazer Rollback"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                {entry.role === "model" && <Code2 className="h-3.5 w-3.5 text-primary" />}{entry.role === "user" ? "Você" : copilotName}
              </div>
              <Markdown>{entry.content}</Markdown>
              {entry.answer && <>
              <div className="mt-3 flex flex-wrap items-center gap-2"><p className="flex-1 text-xs text-muted-foreground">Contexto: {entry.answer.coverage.read} de {entry.answer.coverage.total} arquivos lidos</p>
                {entry.answer.changes.length > 1 && entry.answer.changes.some(c => !entry.resolved?.includes(c.path)) && <Button size="sm" variant="outline" disabled={!!applying || busy} onClick={() => void applyAll(entry)}><Check />Aplicar tudo</Button>}</div>
              <div className="mt-3 space-y-3">{entry.answer.changes.map(change => <div key={change.path} className="overflow-hidden rounded-md border border-border">
                <div className="flex min-w-0 flex-wrap items-center gap-2 bg-sidebar px-3 py-2">
                  <FileCode2 className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate font-mono text-xs" title={change.path}>{change.path}</span>
                  {entry.resolved?.includes(change.path) ? <Check className="h-4 w-4 text-success" /> : <>
                    <Button variant="ghost" size="icon-sm" title="Descartar proposta" aria-label={`Descartar ${change.path}`} disabled={!!applying || busy} onClick={() => resolve(entry.id, change.path)}><X /></Button>
                    <Button size="sm" disabled={!!applying || busy} onClick={() => void applyChange(entry.id, change)}>{applying === change.path ? <Loader2 className="animate-spin" /> : <Check />}Aplicar</Button>
                  </>}
                </div>
                <details className="px-3 py-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Revisar alteração</summary>
                  <div className="mt-2 grid min-w-0 gap-3 md:grid-cols-2">
                    <div className="min-w-0"><p className="mb-1 text-muted-foreground">Atual</p><pre className="max-h-64 overflow-auto bg-muted p-2 font-mono text-xs">{change.before ?? "Arquivo novo"}</pre></div>
                    <div className="min-w-0"><p className="mb-1 text-success">Proposta</p><pre className="max-h-64 overflow-auto bg-success/5 p-2 font-mono text-xs">{change.content}</pre></div>
                  </div>
                </details>
                            </div>)}</div>
            </>}
          </>
        )}
      </article>)}
        {busy && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{isPro ? "Time PRO analisando o projeto…" : "Preparando proposta…"}</p>}
        <div ref={bottomRef} />
      </div>
    </div>
    {overlay}
    </div>
    <div className="relative z-30 shrink-0 border-t border-border bg-background pt-3 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto w-full max-w-3xl px-3 pb-3">
        {isSystem && connection && <div role="status" className="mb-2 flex min-w-0 items-center gap-2 font-mono text-xs text-success" title={`Sessão verificada em ${connection.checkedAt}; agente externo ainda não pareado`}><PlugZap className="h-3.5 w-3.5 shrink-0" /><span className="shrink-0">CANAL PRONTO</span><span className="truncate">{connection.projectName}</span></div>}
        {error && <p role="status" className="mb-2 flex items-start gap-2 text-xs text-muted-foreground"><span className="flex-1">{error}</span><Button variant="ghost" size="icon-sm" title="Dispensar aviso" aria-label="Dispensar aviso" onClick={() => setError(null)}><X /></Button></p>}
        <PromptInput onSubmit={() => void send()}>
          <PromptInputTextarea aria-label="Mensagem para Copilot WLC" placeholder={isSystem ? "wlc:~$" : "O que vamos criar neste projeto?"} value={text} maxLength={isSystem ? 50000 : 8000} onChange={e => setText(e.target.value)} className="min-h-12 text-base" />
          <PromptInputFooter>
            <span className="flex-1"><VersionSelector /></span>
            <PromptInputSubmit status={busy ? "streaming" : "ready"} disabled={!busy && (!text.trim() || !!applying)} onStop={() => { abort.current?.abort(); setConnection(null); setError(isSystem ? "Resposta interrompida; confira status e diff antes de repetir a ação." : "Comando interrompido; nenhum arquivo foi alterado."); }} aria-label={busy ? "Parar Copilot" : "Enviar ao Copilot"} title={busy ? "Parar Copilot" : "Enviar ao Copilot"}>
              {busy ? <Square className="fill-current" /> : <ArrowUp />}
            </PromptInputSubmit>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  </div>;
}