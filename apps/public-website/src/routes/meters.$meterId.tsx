import { createFileRoute } from "@tanstack/react-router";
import { getProductById } from "@/data/products";
import { MeterHero } from "@/components/meters/MeterHero";
import { MeterSpecs } from "@/components/meters/MeterSpecs";
import { SITE_NAME, absoluteUrl, socialMeta } from "@/lib/seo";

export const Route = createFileRoute("/meters/$meterId")({
  loader: ({ params }) => {
    const product = getProductById(params.meterId);
    return { product };
  },
  head: ({ loaderData }) => {
    const product = loaderData?.product;
    if (!product)
      return { meta: [{ title: `Meter Not Found | ${SITE_NAME}` }] };

    const title = `${product.name} | ${SITE_NAME}`;
    const description = product.description;
    const url = absoluteUrl(`/meters/${product.id}`);

    return {
      meta: [
        { title },
        { name: "description", content: description },
        {
          name: "keywords",
          content: `${product.name}, ${product.type} meter, prepaid meter Kenya, sub meter, token meter`,
        },
        ...socialMeta({
          title,
          description,
          url,
          image: absoluteUrl(product.image),
          type: "product",
        }),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            description: product.description,
            image: absoluteUrl(product.image),
            url,
            brand: { "@type": "Brand", name: SITE_NAME },
            offers: {
              "@type": "Offer",
              price: product.price.replaceAll(",", ""),
              priceCurrency: "KES",
              availability: "https://schema.org/InStock",
            },
          }),
        },
      ],
    };
  },
  component: MeterDetailsPage,
});

function MeterDetailsPage() {
  const { product } = Route.useLoaderData();

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
