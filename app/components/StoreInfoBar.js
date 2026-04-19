import Link from "next/link";

export default function StoreInfoBar({
  shopName,
  shopPhone,
  shopAddress,
  ownerHref,
}) {
  return (
    <div className="w-full bg-gray-50 px-6 py-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-gray-800">{shopName}</h2>
        <p className="text-sm text-gray-500 truncate">
          {shopAddress} • {shopPhone}
        </p>
      </div>

      {ownerHref ? (
        <Link
          href={ownerHref}
          className="shrink-0 rounded-xl border border-[#D9C5B8] bg-white px-3 py-2 text-sm font-semibold text-[#6B7556] transition hover:bg-[#FBEAD6]/60"
        >
          Owner dashboard
        </Link>
      ) : null}
    </div>
  );
}