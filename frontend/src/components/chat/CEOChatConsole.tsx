import { useState } from "react";
import { ChatResponse } from "@/types/chat";
import { sendChatMessage } from "@/services/chatService";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Loader2, Send } from "lucide-react";

interface Props {
  onChatResponse: (response: ChatResponse) => void;
  token: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function CEOChatConsole({ onChatResponse, token }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello Founder. How can I help optimize your business today?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await sendChatMessage(userMessage, token);
      onChatResponse(response);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.executive_summary }
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error communicating with the agent network." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-[500px] flex flex-col shadow-sm">
      <CardHeader className="pb-3 border-b bg-muted/20">
        <CardTitle className="text-lg flex items-center">
          <Bot className="h-5 w-5 mr-2 text-primary" />
          CEO Agent Console
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 text-sm ${
                  msg.role === "assistant" ? "flex-row" : "flex-row-reverse"
                }`}
              >
                <div
                  className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                    msg.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {msg.role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <div
                  className={`rounded-lg px-4 py-2 max-w-[80%] ${
                    msg.role === "assistant"
                      ? "bg-muted text-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 text-sm flex-row">
                <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-lg px-4 py-2 bg-muted text-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  EVE is thinking...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-3 border-t bg-muted/10">
        <form
          className="flex w-full gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <Input
            placeholder="Ask about your inventory, pricing, or margins..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
