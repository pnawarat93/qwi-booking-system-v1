export default function StoreInfoBar({ shopName, shopPhone, shopAddress }) {
  return (
    <div className="w-full bg-gray-50 px-6 py-4 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">{shopName}</h2>
        <p className="text-sm text-gray-500">
          {shopAddress} • {shopPhone}
        </p>
      </div>
    </div>
  );
}