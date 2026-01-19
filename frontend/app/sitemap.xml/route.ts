import { NextResponse } from 'next/server';

export async function GET() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>/</loc></url>
  <url><loc>/coaches</loc></url>
  <url><loc>/horarios</loc></url>
  <url><loc>/precios</loc></url>
  <url><loc>/bio</loc></url>
  <url><loc>/portal</loc></url>
</urlset>`;
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'application/xml' } });
}
