import { API_BASE_URL } from "@/lib/api";
import { getHeaders } from "./businessService";
import { ProcessedDocument, ProcessedDocumentDetail } from "@/types/document";

async function handleResponseError(res: Response, defaultMessage: string = "An unexpected error occurred."): Promise<never> {
  let detail = "";
  try {
    const errData = await res.json();
    detail = errData.detail || "";
  } catch {}

  if (detail) {
    throw new Error(detail);
  }
  throw new Error(defaultMessage);
}

export async function uploadDocument(file: File, token: string): Promise<ProcessedDocument> {
  const formData = new FormData();
  formData.append("file", file);

  const headers = getHeaders(token);
  // Remove content-type so the browser automatically sets boundary for multipart/form-data
  delete headers["Content-Type"];

  const res = await fetch(`${API_BASE_URL}/api/documents/upload`, {
    method: "POST",
    headers,
    body: formData
  });

  if (!res.ok) {
    await handleResponseError(res, "Failed to upload document.");
  }

  return res.json();
}

export async function listDocuments(token: string): Promise<ProcessedDocument[]> {
  const res = await fetch(`${API_BASE_URL}/api/documents`, {
    headers: getHeaders(token)
  });

  if (!res.ok) {
    await handleResponseError(res, "Failed to load documents.");
  }

  return res.json();
}

export async function getDocumentDetails(documentId: string, token: string): Promise<ProcessedDocumentDetail> {
  const res = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
    headers: getHeaders(token)
  });

  if (!res.ok) {
    await handleResponseError(res, "Failed to load document details.");
  }

  return res.json();
}

export async function deleteDocument(documentId: string, token: string): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
    method: "DELETE",
    headers: getHeaders(token)
  });

  if (!res.ok) {
    await handleResponseError(res, "Failed to delete document.");
  }

  return res.json();
}

export function getDocumentPreviewUrl(documentId: string, token: string): string {
  // Return the API url directly for iframe/img rendering
  // Append authorization token as a query parameter for standard HTTP requests if needed, 
  // or return the absolute endpoint URL.
  // Note: Since standard img/iframe tags don't support custom headers easily,
  // we can either return the raw endpoint URL (which might require cookie auth or query param if the backend supports it)
  // or fetch the preview as a blob and generate a local object URL in the component.
  // We will provide both options (direct API URL or helper to fetch blob).
  return `${API_BASE_URL}/api/documents/${documentId}/preview`;
}

export async function fetchDocumentPreviewBlob(documentId: string, token: string): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/api/documents/${documentId}/preview`, {
    headers: getHeaders(token)
  });

  if (!res.ok) {
    await handleResponseError(res, "Failed to load document preview.");
  }

  return res.blob();
}
