import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getStoreBySlug } from "@/lib/storeResolver";
import OwnerClientLayout from "./OwnerClientLayout";

export default async function OwnerLayout({ children, params }) {
  const { slug } = await params;
  const session = await getSession();

  // 1. Basic Auth Check
  console.log(session ? `Session found for owner ID: ${session.owner.id}` : "No session found");
  if (!session || !session.owner) {
    // Redirect to SaaS Portal login
    //const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || "http://localhost:3000";
    return redirect(`/s/${slug}/owner-login`);
  }

  // 2. Resolve Store
  const store = await getStoreBySlug(slug);
  if (!store) {
    return redirect("/search"); // Or error page
  }

  // 3. Ownership Verification (The SSO "Gate")
  // Both the owner data in JWT and the store record must have the same owner_id
  if (String(session.owner.id) !== String(store.owner_id)) {
    console.error(`Access Denied: Owner ${session.owner.id} attempted to access Store ${store.id} owned by ${store.owner_id}`);
    return redirect("/unauthorized"); 
  }

  return (
    <OwnerClientLayout 
      activeSlug={slug} 
      storeName={store.name}
    >
      {children}
    </OwnerClientLayout>
  );
}