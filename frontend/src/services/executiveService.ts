import { API_BASE_URL } from "@/lib/api";
import { getHeaders } from "./businessService";
import { 
  ExecutiveChatResponse, 
  DailyBriefResponse, 
  BusinessGoalResponse, 
  AIRecommendationResponse 
} from "@/types/executive";

async function handleResponseError(res: Response, defaultMessage: string = "An unexpected error occurred."): Promise<never> {
  let detail = "";
  try {
    const errData = await res.json();
    detail = errData.detail || "";
  } catch {}

  const status = res.status;
  const detailStr = String(detail);

  if (
    status === 429 ||
    detailStr.includes("429") ||
    detailStr.includes("RESOURCE_EXHAUSTED") ||
    detailStr.includes("busy")
  ) {
    throw new Error("EVE is temporarily busy. Please retry in a few moments.");
  }

  if (
    status === 503 ||
    detailStr.includes("503") ||
    detailStr.includes("unavailable") ||
    detailStr.includes("Gemini")
  ) {
    throw new Error("AI analysis is temporarily unavailable.");
  }

  if (
    status === 504 ||
    detailStr.includes("504") ||
    detailStr.includes("Timeout") ||
    detailStr.includes("timed out")
  ) {
    throw new Error("Request timed out. Please try again.");
  }

  if (detail && status !== 500) {
    throw new Error(detail);
  }

  throw new Error(defaultMessage);
}

export async function sendExecutiveChat(
  message: string, 
  token: string, 
  conversationId?: string, 
  mode: string = "smart",
  developerMode?: boolean,
  language?: string,
  documentId?: string
): Promise<ExecutiveChatResponse> {
  const res = await fetch(`${API_BASE_URL}/api/executive/chat`, {
    method: "POST",
    headers: getHeaders(token, "application/json"),
    body: JSON.stringify({
      question: message,
      conversation_id: conversationId || null,
      mode,
      language: language || "en",
      developer_mode: developerMode !== undefined ? developerMode : null,
      document_id: documentId || null
    })
  });
  if (!res.ok) {
    await handleResponseError(res, "An unexpected error occurred.");
  }
  return res.json();
}

export async function getDailyBrief(token: string): Promise<DailyBriefResponse> {
  const res = await fetch(`${API_BASE_URL}/api/executive/daily-brief`, {
    method: "GET",
    headers: getHeaders(token)
  });
  if (!res.ok) {
    await handleResponseError(res, "An unexpected error occurred.");
  }
  return res.json();
}

export async function listGoals(token: string): Promise<BusinessGoalResponse[]> {
  const res = await fetch(`${API_BASE_URL}/api/executive/goals`, {
    method: "GET",
    headers: getHeaders(token)
  });
  if (!res.ok) {
    await handleResponseError(res, "Failed to fetch goals");
  }
  return res.json();
}

export async function addGoal(
  goal: { goal_type: string; description: string; target_value?: number }, 
  token: string
): Promise<BusinessGoalResponse> {
  const res = await fetch(`${API_BASE_URL}/api/executive/goals`, {
    method: "POST",
    headers: getHeaders(token, "application/json"),
    body: JSON.stringify(goal)
  });
  if (!res.ok) {
    await handleResponseError(res, "Failed to add goal");
  }
  return res.json();
}

export async function deleteGoal(goalId: string, token: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE_URL}/api/executive/goals/${goalId}`, {
    method: "DELETE",
    headers: getHeaders(token)
  });
  if (!res.ok) {
    await handleResponseError(res, "Failed to delete goal");
  }
  return res.json();
}

export async function getRecommendations(
  token: string, 
  limit: number = 10
): Promise<AIRecommendationResponse[]> {
  const res = await fetch(`${API_BASE_URL}/api/executive/recommendations?limit=${limit}`, {
    method: "GET",
    headers: getHeaders(token)
  });
  if (!res.ok) {
    await handleResponseError(res, "Failed to fetch recommendations");
  }
  return res.json();
}

export async function listConversations(token: string): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/api/executive/conversations`, {
    method: "GET",
    headers: getHeaders(token)
  });
  if (!res.ok) {
    await handleResponseError(res, "Failed to fetch conversations");
  }
  return res.json();
}

export async function getConversation(conversationId: string, token: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/executive/conversations/${conversationId}`, {
    method: "GET",
    headers: getHeaders(token)
  });
  if (!res.ok) {
    await handleResponseError(res, "Failed to load conversation history");
  }
  return res.json();
}

export async function renameConversation(conversationId: string, title: string, token: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/executive/conversations/${conversationId}`, {
    method: "PATCH",
    headers: getHeaders(token, "application/json"),
    body: JSON.stringify({ title })
  });
  if (!res.ok) {
    await handleResponseError(res, "Failed to rename conversation");
  }
  return res.json();
}

export async function deleteConversation(conversationId: string, token: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/executive/conversations/${conversationId}`, {
    method: "DELETE",
    headers: getHeaders(token)
  });
  if (!res.ok) {
    await handleResponseError(res, "Failed to delete conversation");
  }
  return res.json();
}

