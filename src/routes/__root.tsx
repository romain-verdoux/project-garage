import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { ServerFnAuthBridge } from "@/components/ServerFnAuthBridge";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Dream Garage Project — Car Project Library" },
      { name: "description", content: "Browse classic and modern car projects with restoration difficulty, parts cost and known defects." },
      { property: "og:title", content: "Dream Garage Project — Car Project Library" },
      { property: "og:description", content: "Browse classic and modern car projects with restoration difficulty, parts cost and known defects." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Dream Garage Project — Car Project Library" },
      { name: "twitter:description", content: "Browse classic and modern car projects with restoration difficulty, parts cost and known defects." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0420e8fe-f909-409f-90fa-23b302d08b52/id-preview-86ac8011--5407a6a8-e3a2-4927-a2ea-6d344421e5ca.lovable.app-1777326854657.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0420e8fe-f909-409f-90fa-23b302d08b52/id-preview-86ac8011--5407a6a8-e3a2-4927-a2ea-6d344421e5ca.lovable.app-1777326854657.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <ServerFnAuthBridge />
      <SiteHeader />
      <Outlet />
      <Toaster richColors position="bottom-right" />
    </>
  );
}
