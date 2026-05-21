import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Qwi",
  description: "Booking system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}

        <Toaster
          position="top-center"
          toastOptions={{
            duration: 2600,
            style: {
              background: "#4A3A34",
              color: "#fff",
              borderRadius: "16px",
              padding: "14px 18px",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow:
                "0 10px 25px rgba(0,0,0,0.12)",
            },

            success: {
              style: {
                background: "#355E4B",
              },
            },

            error: {
              style: {
                background: "#8B3A3A",
              },
            },
          }}
        />
      </body>
    </html>
  );
}