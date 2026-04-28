import { Link, useNavigate } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { useProjects, projectsStore } from "@/lib/projects-store";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  useProjects();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const count = mounted ? Object.keys(projectsStore.getAll().projects).length : 0;
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <header className="border-b-2 border-foreground/15 bg-card/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground grid place-items-center shadow-[var(--shadow-stamp)]">
            <Wrench className="h-5 w-5" />
          </div>
          <div className="leading-none">
            <div className="font-display text-2xl tracking-wide">GARAGE LOG</div>
            <div className="font-stencil text-[10px] text-muted-foreground uppercase">est. project library</div>
          </div>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{ className: "text-primary" }}
            className="hover:text-primary transition-colors uppercase tracking-wider"
          >
            Library
          </Link>
          <Link
            to="/my-projects"
            activeProps={{ className: "text-primary" }}
            className="hover:text-primary transition-colors uppercase tracking-wider flex items-center gap-2"
          >
            My Car Projects
            <span
              suppressHydrationWarning
              className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-primary text-primary-foreground text-xs font-bold"
            >
              {count}
            </span>
          </Link>
          {mounted && isAdmin && (
            <Link
              to="/admin"
              activeProps={{ className: "text-primary" }}
              className="hover:text-primary transition-colors uppercase tracking-wider"
            >
              Admin
            </Link>
          )}
          {mounted && (user ? (
            <button
              onClick={signOut}
              className="hover:text-primary transition-colors uppercase tracking-wider"
            >
              Sign out
            </button>
          ) : (
            <Link
              to="/auth"
              className="hover:text-primary transition-colors uppercase tracking-wider"
            >
              Sign in
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
