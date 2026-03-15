import "./globals.css";
import Header from "./components/Header";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Jong",
  description: "Elegant booking experience",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen text-[#4A3A34]`}>
        <Header />
        <main className="mx-auto w-[92%] max-w-5xl py-8 sm:py-10">
          {children}
        </main>
      </body>
    </html>
  );
}