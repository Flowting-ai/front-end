import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    
    // Replace YOUR_BACKEND_URL with your actual backend endpoint
    const response = await fetch('http://127.0.0.1:8000/response/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error('Backend request failed');
    }

    const data = await response.json();
    
    // Adjust 'data.response' based on your backend's response structure
    return NextResponse.json({ response: data.response });
    
  } catch (error) {
    console.error('Backend API Error:', error);
    return NextResponse.json(
      { response: "API didn't respond" },
      { status: 500 }
    );
  }
}