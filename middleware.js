import { NextResponse } from 'next/server';
import checkUserPermission from "./app/lib/user/userPermissionsServerSide"
import { auth0 } from "./app/lib/auth0";
//
//
//
//
//

export async function middleware(req) {
  const url = new URL(req.url)
  const authResponse = await auth0.middleware(req)

  if (url.pathname.startsWith("/auth")) {
    return authResponse
  }

  const session = await auth0.getSession(req)
  const typeConnc = url.pathname.startsWith("/api/") ? "api" : "page"

  if (!session) {
    if (typeConnc === "api") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const loginUrl = new URL("/auth/login", req.url)
    loginUrl.searchParams.set("returnTo", url.pathname + url.search)
    return NextResponse.redirect(loginUrl)
  }

  const canUserAccess = await checkUserPermission(url, typeConnc, session.user.sub.replace("auth0|", ""))
  if (!canUserAccess) {
    if (typeConnc === "api") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    // 1. Get the original request's URL as a base
    const url = req.nextUrl.clone();
    // 2. Set the new path
    url.pathname = '/not-allowed';
    // 3. Rewrite to the new, absolute URL
    return NextResponse.rewrite(url);
  }
  return authResponse


}
//
//

//
//
//
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ]
}
/*
      .Escrever na session.
  const res = new NextResponse();
  const session = await getSession(req, res)
  console.log(session)


  session.user.customProperty = 'valor personalizado';
  console.log(session)



  // converter session.acessTokenExpiresAt
  new Date ( 1721265770 *1000 )
*/
/* Lógica para alterar o acess token segundo o gemini - nao testei
 
    import { NextResponse } from 'next/server';
    import { getSession } from '@auth0/nextjs-auth0';

    export const middleware = async (req: NextRequest) => {
      const res = NextResponse.next();

      // Get the session from the request
      const session = await getSession(req, res);

      // Check if the user is logged in
      if (session?.isLoggedIn) {
        // Check if the access token is about to expire
        const accessTokenExpiresAt = session.accessTokenExpiresAt;
        const now = Date.now();
        if (accessTokenExpiresAt && now + 60000 > accessTokenExpiresAt) {
          // Refresh the access token
          const newAccessToken = await refreshAccessToken(session.refreshToken);

          // Update the session with the new access token
          session.accessToken = newAccessToken;
          session.accessTokenExpiresAt = Date.now() + session.accessTokenExpiresIn * 1000;

          // Update the authorization header in the response
          res.cookies.set('auth', JSON.stringify(session));
        }
      }

      // Continue with the middleware
      return res;
    };

    // Replace this with your actual refresh token function
    async function refreshAccessToken(refreshToken: string) {
      // Implement your logic to refresh the access token using the refresh token
      // and return the new access token
}

*/
