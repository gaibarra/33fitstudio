export async function GET() {
  const body = `User-agent: *\nAllow: /`;
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}
