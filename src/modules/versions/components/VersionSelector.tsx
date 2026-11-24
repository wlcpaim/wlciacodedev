import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { versionsQuery } from "../queries";
import { syncChatVersions } from "../functions/versions.functions";
import { BASE_VERSION } from "../instructions";
import { PRO_SLUG, SYSTEM_SLUG, COPILOT_199_SLUG, setSelectedVersion, useSelectedVersion } from "../selected";

/** Auto-check a cada 1 minuto: busca versões novas/alteradas no repositório. */
export function useVersionsAutoSync() {
  const qc = useQueryClient();
  const sync = useServerFn(syncChatVersions);
  useEffect(() => {
    let alive = true;
    const run = () => sync().then(r => {
      if (alive && r.changed) void qc.invalidateQueries({ queryKey: ["chat-versions"] });
    }).catch(() => {});
    void run();
    const timer = setInterval(run, 60_000);
    return () => { alive = false; clearInterval(timer); };
  }, [qc, sync]);
}

export function VersionSelector() {
  useVersionsAutoSync();
  const { data = [] } = useQuery(versionsQuery);
  const selected = useSelectedVersion();
  const isPro = selected === PRO_SLUG;
  const isSystem = selected === SYSTEM_SLUG;
  const is199 = selected === COPILOT_199_SLUG;
  const current = data.find(v => v.id === selected);
  useEffect(() => { 
    if (selected && !isPro && !isSystem && !is199 && data.length && !current) {
      setSelectedVersion(null);
    }
  }, [selected, isPro, isSystem, is199, data, current]);

  const activeName = is199
    ? "WLC 1.9.9"
    : isPro 
    ? "WLC 1.7.1" 
    : selected === SYSTEM_SLUG 
    ? "WLC 1.1.0" 
    : (current?.name ?? BASE_VERSION.name);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 font-mono text-xs" aria-label="Selecionar versão da IA" title="Versão da IA">
          <BrainCircuit className="h-4 w-4 text-primary" />
          {activeName}
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Versão da IA</DropdownMenuLabel>
        
        {/* WLC 1.5.6 Lite */}
        <DropdownMenuItem onSelect={() => setSelectedVersion(null)}>
          <span className="flex-1">
            <span className="block font-mono text-sm">{BASE_VERSION.name}</span>
            <span className="block text-xs text-muted-foreground">Lite</span>
          </span>
          {!current && !isPro && !isSystem && <Check />}
        </DropdownMenuItem>

        {/* WLC 1.7.1 Pro */}
        <DropdownMenuItem onSelect={() => setSelectedVersion(PRO_SLUG)}>
          <span className="flex-1">
            <span className="block font-mono text-sm">WLC 1.7.1</span>
            <span className="block text-xs text-muted-foreground">Pro</span>
          </span>
          {isPro && <Check />}
        </DropdownMenuItem>

        {/* WLC 1.1.0 System */}
        <DropdownMenuItem onSelect={() => setSelectedVersion(SYSTEM_SLUG)}>
          <span className="flex-1">
            <span className="block font-mono text-sm">WLC 1.1.0</span>
            <span className="block text-xs text-muted-foreground">System</span>
          </span>
          {selected === SYSTEM_SLUG && <Check />}
        </DropdownMenuItem>

        {/* WLC 1.9.9 Copilot */}
        <DropdownMenuItem onSelect={() => setSelectedVersion(COPILOT_199_SLUG)}>
          <span className="flex-1">
            <span className="block font-mono text-sm">WLC 1.9.9</span>
            <span className="block text-xs text-muted-foreground">Copilot</span>
          </span>
          {is199 && <Check />}
        </DropdownMenuItem>

        {data.length > 0 && <DropdownMenuSeparator />}
        {data.map(v => (
          <DropdownMenuItem key={v.id} onSelect={() => setSelectedVersion(v.id)}>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-sm">{v.name}</span>
              <span className="block text-xs text-muted-foreground">
                {v.rules.length} regra{v.rules.length === 1 ? "" : "s"} aprendida{v.rules.length === 1 ? "" : "s"}
              </span>
            </span>
            {current?.id === v.id && <Check />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
