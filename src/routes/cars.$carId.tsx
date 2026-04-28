import { createFileRoute, Link, Navigate, notFound, useRouter } from "@tanstack/react-router";
import { getCar } from "@/data/cars";
import { projectsStore, useProjects } from "@/lib/projects-store";
import { CarDetailView } from "@/components/CarDetailView";

export const Route = createFileRoute("/cars/$carId")({
  loader: ({ params }) => {
    const car = getCar(params.carId);
    if (!car) throw notFound();
    return { car };
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.car.name} — Garage Log` },
            { name: "description", content: loaderData.car.history.slice(0, 155) },
            { property: "og:title", content: `${loaderData.car.name} — Garage Log` },
            { property: "og:description", content: loaderData.car.history.slice(0, 155) },
            { property: "og:image", content: loaderData.car.image },
            { name: "twitter:image", content: loaderData.car.image },
          ],
        }
      : {},
  component: CarDetail,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="font-display text-5xl mb-4">Car not found</h1>
      <Link to="/" className="text-primary underline">Back to library</Link>
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl mb-3">Something went wrong</h1>
        <p className="text-muted-foreground mb-6">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Try again
        </button>
      </div>
    );
  },
});

function CarDetail() {
  const { car } = Route.useLoaderData();
  useProjects();

  // If this car is already in the user's projects, the canonical URL is /my-projects/$carId.
  if (projectsStore.has(car.id)) {
    return <Navigate to="/my-projects/$carId" params={{ carId: car.id }} replace />;
  }

  return <CarDetailView car={car} context="library" />;
}
