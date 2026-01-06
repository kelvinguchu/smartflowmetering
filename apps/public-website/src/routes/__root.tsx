import {
  HeadContent,
  Scripts,
  createRootRoute,
  Outlet,
  Link,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Ohm Kenya Limited | Smart Utility Management",
      },
      {
        name: "description",
        content:
          "Seamless prepaid electricity, water, and gas metering solutions.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
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
