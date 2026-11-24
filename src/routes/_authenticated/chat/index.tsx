import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ConversationHistory, useNewChat } from "@/components/chat/ConversationHistory";
import { CenterAction } from "@/components/nav/CenterAction";

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({ meta: [
    { title: "Chats — WLC IA" }, { name: "description", content: "Comece uma nova conversa com a WLC IA." },
    { property: "og:title", content: "Chats — WLC IA" }, { property: "og:description", content: "Converse com a WLC IA." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ChatsIndex,
});

function ChatsIndex() {
  const [open, setOpen] = useState(false);
  const create = useNewChat();
  return <CenterAction label="Novo chat" onClick={() => create.mutate()} pending={create.isPending} corner={
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground [&_svg]:size-6" aria-label="Conversas anteriores" title="Conversas anteriores"><FolderOpen /></Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="px-4 pb-2 pt-4"><SheetTitle className="text-sm font-medium">Conversas</SheetTitle></SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col px-3">
          <Suspense fallback={null}><ConversationHistory onOpen={() => setOpen(false)} /></Suspense>
        </div>
      </SheetContent>
    </Sheet>
  } />;
}
