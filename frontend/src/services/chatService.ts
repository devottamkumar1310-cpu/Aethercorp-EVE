import { API_BASE_URL, apiFetch } from "@/lib/api";
import { ChatResponse } from "@/types/chat";
import { getHeaders } from "./businessService";

export async function sendChatMessage(message: string, token: string): Promise<ChatResponse> {
  const response = await apiFetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: getHeaders(token, "application/json"),
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send chat message: ${response.statusText}`);
  }

  const data = await response.json();
  return data as ChatResponse;
}
