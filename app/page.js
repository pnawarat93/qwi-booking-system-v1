import TypeBox from "./components/TypeBox";
import Header from "./components/Header";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return ( 
    <>
      <Header />
      <section id="shopdetail">
        <div className="w-full min-h-60 font-serif text-[#6b9161] flex justify-center items-center flex-col gap-3">
          <h1 className="text-5xl">Shop Name</h1>
          <h2 className="text-2xl">Shop Address</h2>
        </div>
      </section>
      <Link href="/booking">Book Now</Link>
      
     </>
  );
}