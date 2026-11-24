import { createFileRoute, Outlet } from "@tanstack/react-router";
import { conversationsQuery } from "@/services/chat.queries";

export const Route = createFileRoute("/_authenticated/chat")({
  loader: ({ context }) => context.queryClient.fetchQuery(conversationsQuery),
  component: ChatLayout,
});

/** O chat não tem menu lateral nem barra inferior; histórico é acessado fora da conversa. */
function ChatLayout() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
