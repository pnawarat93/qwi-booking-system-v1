import Image from "next/image";

export default function TypeBox(props) {

  return (
        <div className="bg-gray-200 p-5 w-[50%] flex flex-col justify-center items-center rounded-2xl">
            <Image 
                src="/img-1.jpg"
                width={100} height={100}/>
            <p>{props.title}</p>
        </div>
  );
}