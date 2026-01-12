import {NextResponse} from 'next/server';
import {chat} from '@/ai/flows/chat';

export async function POST(req: Request) {
  try {
    const {prompt} = await req.json();

    if (!prompt) {
      return NextResponse.json(
        {response: 'Prompt is required.'},
        {status: 400}
      );
    }

    const response = await chat(prompt);

    return NextResponse.json({response});
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      {response: "Sorry, I'm having trouble responding right now."},
      {status: 500}
    );
  }
}
