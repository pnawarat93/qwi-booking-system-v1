import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Qwi",
  description: "Elegant booking experience",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} text-[#4A3A34]`}>
        {children}
      </body>
    </html>
  );
}