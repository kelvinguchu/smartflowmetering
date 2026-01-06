import { createFileRoute } from "@tanstack/react-router";
import { getProductById } from "@/data/products";
import { MeterHero } from "@/components/meters/MeterHero";
import { MeterSpecs } from "@/components/meters/MeterSpecs";

export const Route = createFileRoute("/meters/$meterId")({
  component: MeterDetailsPage,
});

function MeterDetailsPage() {
  const { meterId } = Route.useParams();
  const product = getProductById(meterId);

  if (!product) {
    return (
      <main className='pt-8 md:pt-24'>
        <div className='container max-w-screen-2xl px-4 sm:px-8 py-16 text-center'>
          <h1 className='text-2xl font-bold'>Product not found</h1>
          <p className='text-muted-foreground mt-2'>
            The meter you're looking for doesn't exist.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className='pt-16 md:pt-24'>
      <MeterHero product={product} />
      <MeterSpecs product={product} />
    </main>
  );
}
