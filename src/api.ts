export const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? "" : "https://api.leafydew.in");

type Body = Record<string, unknown> | undefined;

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });

  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data && typeof data.message === "string"
        ? data.message
        : "Unable to load this section.";
    throw new Error(message);
  }

  return data as T;
}

export function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path);
}

export function postJson<T>(path: string, body?: Body): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    body: JSON.stringify(body ?? {})
  });
}

export function putJson<T>(path: string, body?: Body): Promise<T> {
  return requestJson<T>(path, {
    method: "PUT",
    body: JSON.stringify(body ?? {})
  });
}

export function deleteJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, {
    method: "DELETE"
  });
}
