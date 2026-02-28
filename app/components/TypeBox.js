import { AlarmCheck } from "lucide-react";

export default function TypeBox(props) {
    if (props.type == "service") {
        return (

            <div className="
        bg-white p-3 w-52.5
        rounded-2xl
        mx-auto
        border shadow-sm
        ">
                <div className="flex items-center justify-between">
                    <p className="font-semibold">{props.title}</p>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                        <AlarmCheck size={20} />
                        <span>{props.servtime}</span>
                    </div>
                </div>
                <div className="mt-1">
                    <p className="font-bold flex">${props.price}</p>
                </div>

            </div>
        )
    }
    else if (props.type == "numberppl") {
        return (

            <div className="
        bg-white p-3 w-52.5
        rounded-2xl
        mx-auto
        border shadow-sm
        ">
                <div className="flex items-center justify-between">
                    <p className="font-semibold">{props.pplnum} person</p>
                </div>


            </div>
        )
    }
    else if (props.type == "time") {
        return (

            <div className="
        bg-white p-3 w-52.5
        rounded-2xl
        mx-auto
        border shadow-sm
        ">
                <div className="flex items-center justify-between">
                    <p className="font-semibold">{props.time}</p>
                </div>
            </div>
        )
    }
    return

}