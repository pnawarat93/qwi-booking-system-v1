import Header from "../components/Header";

export default function PublicLayout({ children }) {
  return (
    <>
      <Header />
      <main className="mx-auto w-[92%] max-w-5xl py-8 sm:py-10">
        {children}
      </main>
    </>
  );
}