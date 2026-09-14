import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const apiKey = body.apiKey || process.env.POLZA_AI_API_KEY || '';

    if (!apiKey) {
      return NextResponse.json(
        { valid: false, error: 'API-ключ не передан' },
        { status: 400 }
      );
    }

    // Call Polza.ai models endpoint to verify key
    const response = await fetch('https://polza.ai/api/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        {
          valid: false,
          status: response.status,
          error: `Ошибка авторизации Polza.ai (${response.status}): ${errText.slice(0, 200)}`,
        },
        { status: 200 } // return 200 so UI can display friendly error
      );
    }

    const data = await response.json();
    const modelsCount = Array.isArray(data.data) ? data.data.length : 0;

    return NextResponse.json({
      valid: true,
      modelsCount,
      message: 'API-ключ Polza.ai успешно проверен и активен!',
    });
  } catch (err) {
    console.error('Error testing Polza key:', err);
    return NextResponse.json(
      { valid: false, error: 'Сетевая ошибка при проверке ключа. Попробуйте позже.' },
      { status: 500 }
    );
  }
}
