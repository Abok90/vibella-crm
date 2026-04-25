import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const shop = url.searchParams.get('shop');

  if (!code || !shop) {
    return new Response('Missing code or shop parameter', { status: 400 });
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID || '';
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET || '';

  try {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });

    const data = await response.json();

    if (data.access_token) {
      return new Response(`
        <html dir="rtl">
          <head>
            <meta charset="utf-8" />
            <title>تم بنجاح!</title>
          </head>
          <body style="font-family: system-ui, sans-serif; padding: 40px; background: #1A1817; color: white;">
            <div style="background: #2D2A29; padding: 30px; border-radius: 12px; border: 1px solid #3f3f46; max-width: 600px; margin: auto; text-align: right;">
              <h1 style="color: #95BF47;">تم التثبيت بنجاح 🎉</h1>
              <p style="font-size: 16px; color: #a1a1aa;">شوبيفاي وافق على ربط النظام. وده هو مفتاح الوصول السري الدائم (Access Token):</p>
              <div style="background: #18181b; color: #4ade80; padding: 15px; border-radius: 6px; font-family: monospace; word-break: break-all; margin: 20px 0; border: 1px solid #27272a; text-align: left; font-size: 1.2rem;">
                ${data.access_token}
              </div>
              <p style="color: #fca5a5; font-weight: bold; font-size: 16px; margin-top: 30px; padding: 15px; background: #450a0a; border-radius: 8px;">
                ⚠️ رجاءً انسخ المفتاح الأخضر اللي فوق ده، وابعتهولي في الشات دلوقتي فوراً عشان أبرمجلك شاشة الجلب اليدوي النهائية!
              </p>
            </div>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } else {
      return new Response('Error getting access token: ' + JSON.stringify(data), { status: 500 });
    }
  } catch (err: any) {
    return new Response('Request failed: ' + err.message, { status: 500 });
  }
}
