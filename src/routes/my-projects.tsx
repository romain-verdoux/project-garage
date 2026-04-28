import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/my-projects")({
  component: MyProjectsLayout,
});

function MyProjectsLayout() {
  return <Outlet />;
}