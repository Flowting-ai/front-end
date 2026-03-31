import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const baseUrl = process.env.SERVER_URL!;

  const targetUrl = new URL("/chat/", baseUrl);
  const incomingHeaders = new Headers(req.headers);

  try {
    const payload = await req.json();
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(incomingHeaders.get("authorization")
          ? { authorization: incomingHeaders.get("authorization") as string }
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
