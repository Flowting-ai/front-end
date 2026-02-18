import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_API!;

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
