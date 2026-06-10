import { NextResponse } from "next/server";

export async function GET(request, context) {
  const params = await context.params;
  const url = new URL(request.url);

  url.pathname = `/auth/${params.auth0}`;

  return NextResponse.redirect(url);
}
