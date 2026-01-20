import { NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest) {
  try {
    // This endpoint is currently not implemented
    // It's a placeholder for future upload functionality
    return NextResponse.json(
      { error: 'Endpoint not implemented' },
      { status: 501 }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
