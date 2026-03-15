"use client";

import { useState } from "react";
import StoreInfoBar from "../components/StoreInfoBar";
import ScheduleToolbar from "../components/ScheduleToolbar";
import ScheduleGrid from "../components/ScheduleGrid";
import { format } from "date-fns";

export default function AdminPage() {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

    return (
        <div>
            <StoreInfoBar
                shopName="Wellness Thai Massage"
                shopPhone="02 1234 5678"
                shopAddress="123 Pitts Street, Sydney"
            />

            <ScheduleToolbar 
                selectedDate={selectedDate} 
                onDateChange={(e) => setSelectedDate(e.target.value)}
                dateLabel={format(new Date(selectedDate), "EEEE, d MMMM yyyy")} 
            />

            <ScheduleGrid selectedDate={selectedDate} />
        </div>
    );
}