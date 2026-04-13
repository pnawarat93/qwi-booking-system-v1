

import Header from "@/app/components/Header";
import { getStoreBySlug } from "@/lib/storeResolver";

export default async function StorePublicLayout({ children, params }) {
  const { slug } = await params
  const store = await getStoreBySlug(slug);

  return (
    <>
      <Header storeName={store.name} />
      <main className="mx-auto w-[92%] max-w-5xl py-8 sm:py-10">
        {children}
      </main>
    </>
  );
}
