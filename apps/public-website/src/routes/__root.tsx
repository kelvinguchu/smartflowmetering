import {
  HeadContent,
  Scripts,
  createRootRoute,
  Outlet,
  Link,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Footer } from "../components/layout/Footer";
import { Header } from "../components/layout/Header";
import appCss from "../styles.css?url";
import {
  SITE_NAME,
  SITE_TAGLINE,
  DEFAULT_DESCRIPTION,
  absoluteUrl,
  OG_IMAGE_PATH,
  organizationJsonLd,
} from "@/lib/seo";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${SITE_NAME} | ${SITE_TAGLINE}` },
      { name: "description", content: DEFAULT_DESCRIPTION },
      { name: "theme-color", content: "#fb6200" },
      { name: "author", content: SITE_NAME },
      { name: "robots", content: "index, follow" },
      // Default OG tags (overridden per-route)
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:locale", content: "en_KE" },
      { property: "og:image", content: absoluteUrl(OG_IMAGE_PATH) },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      {
        rel: "apple-touch-icon",
        sizes: "192x192",
        href: "/logo192.png",
      },
      { rel: "manifest", href: "/manifest.json" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(organizationJsonLd()),
      },
      {
        src: "https://www.googletagmanager.com/gtag/js?id=G-8BRKJ4R6WY",
        async: true,
      },
      {
        children: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-8BRKJ4R6WY');`,
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: () => (
    <div className='p-4'>
      Page Not Found <Link to='/'>Go Home</Link>
    </div>
  ),
});

function RootComponent() {
  return (
    <RootDocument>
      <div className='flex min-h-screen flex-col font-sans'>
        <Header />
        <main className='flex-1'>
          <Outlet />
        </main>
        <Footer />
      </div>
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackRouterDevtools position='bottom-right' />
        <Scripts />
      </body>
    </html>
  );
}
