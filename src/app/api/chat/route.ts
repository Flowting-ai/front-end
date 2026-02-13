import { NextResponse } from "next/server";

const DEFAULT_BACKEND_URL = "https://jellyfish-app-7brqd.ondigitalocean.app";

const resolveBackendBaseUrl = () => {
  const raw =
    process.env.NEXT_PUBLIC_HOST_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    DEFAULT_BACKEND_URL;
  return raw.startsWith("http") ? raw : `http://${raw}`;
};

export async function POST(req: Request) {
  const baseUrl = resolveBackendBaseUrl();

  const targetUrl = new URL("/chat/", baseUrl);
  const incomingHeaders = new Headers(req.headers);
  const csrfToken =
    incomingHeaders.get("x-csrftoken") || incomingHeaders.get("X-CSRFToken");

  try {
    const payload = await req.json();
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        ...(incomingHeaders.get("cookie")
          ? { cookie: incomingHeaders.get("cookie") as string }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { response: "Sorry, I'm having trouble responding right now." },
      { status: 500 }
    );
  }
}
