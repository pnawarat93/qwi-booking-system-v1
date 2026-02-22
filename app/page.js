import TypeBox from "./components/TypeBox";


export default function Home() {
  return ( 
  <div className="flex flex-col justify-center items-center w-[80%] gap-3">
    <h1>Booking System</h1>
    <h2>Select your massage type</h2>
      <TypeBox title="Traditional Thai Massage"/>
      <TypeBox title="Aroma Oil"/>
  </div>

  );
}
