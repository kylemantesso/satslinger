import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log('Received webhook payload:', payload);

    // Optionally, add any processing logic here.
    // For now, simply acknowledge receipt with a success response.
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}