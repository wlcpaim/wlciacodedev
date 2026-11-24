import { useState } from "react";
import { ArrowUp, Square, FileCode2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";

export function Composer({ onSend, onStop, streaming, files = [], onRemoveFile }: {
  onSend: (t: string) => void; onStop: () => void; streaming: boolean;
  files?: string[]; onRemoveFile?: (path: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-2 sm:pb-3 pb-[env(safe-area-inset-bottom)]">
      {files.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">
        {files.map(f => <span key={f} title={f} className="inline-flex max-w-full items-center gap-1 rounded-md border bg-secondary px-2 py-1 font-mono text-xs text-secondary-foreground">
          <FileCode2 className="h-3 w-3 shrink-0" /><span className="truncate">{f.split("/").pop()}</span>
          {onRemoveFile && <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover ${f}`} title={`Remover ${f}`} onClick={() => onRemoveFile(f)}><X /></Button>}
        </span>)}
      </div>}
      <PromptInput onSubmit={() => {
        const message = text.trim();
        if (!message || streaming) return;
        onSend(message); setText("");
      }}>
        <PromptInputTextarea value={text} onChange={e => setText(e.target.value)} placeholder="Mensagem para wlc.ia" aria-label="Mensagem" className="min-h-12 text-base" />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit status={streaming ? "streaming" : "ready"} disabled={!streaming && !text.trim()} onStop={onStop}
            aria-label={streaming ? "Parar geração" : "Enviar"} title={streaming ? "Parar geração" : "Enviar"}>
            {streaming ? <Square className="fill-current" /> : <ArrowUp />}
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}