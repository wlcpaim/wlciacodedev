import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { chatHistoryQuery } from "@/services/chat.queries";
import { ChatWindow } from "@/components/chat/ChatWindow";

export const Route = createFileRoute("/_authenticated/chat/$conversationId")({
  loader: ({ context, params }) => context.queryClient.fetchQuery(chatHistoryQuery(params.conversationId)),
  head: ({ loaderData }) => ({ meta: [
    { title: `${loaderData?.conversation.title ?? "Conversa"} — WLC IA` },
    { name: "description", content: "Conversa privada no WLC IA." }, { property: "og:title", content: "Conversa — WLC IA" },
    { property: "og:description", content: "Seu chat com WLC IA." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ConversationPage,
});
function ConversationPage() {
  const { conversationId } = Route.useParams();
  const { data } = useSuspenseQuery(chatHistoryQuery(conversationId));
  return <ChatWindow key={conversationId} id={conversationId} title={data.conversation.title} initial={data.messages} />;
}