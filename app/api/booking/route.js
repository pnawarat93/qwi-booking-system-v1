import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request) {
  const body = await request.json();
  
  const partySize = body.party_size || 1;

  // 1. Fetch service duration
  const { data: service } = await supabase.from('services').select('duration').eq('id', body.service_id).single();
  if (!service) {
    return NextResponse.json({ error: "Invalid service_id" }, { status: 400 });
  }
  const duration = service.duration;

  // 2. Fetch all staff
  const { data: staffs } = await supabase.from('users').select('id').eq('role', 'Staff');
  if (!staffs || staffs.length === 0) {
    return NextResponse.json({ error: "No staff available" }, { status: 500 });
  }

  // 3. Fetch all bookings for this date and time range
  const { data: bookings } = await supabase.from('jobs').select('staff_id, time, services(duration)').eq('date', body.date).neq('job_status', 'Cancelled');

  // 4. Calculate available staff
  const [h, m] = body.time.split(':').map(Number);
  const requestedStart = h * 60 + m;
  const requestedEnd = requestedStart + duration;

  let availableStaffIds = staffs.map(s => s.id);

  if (bookings && bookings.length > 0) {
    bookings.forEach(b => {
      if (!b.time || !b.staff_id) return;
      const [bh, bm] = b.time.split(':').map(Number);
      const bStart = bh * 60 + bm;
      const bDuration = b.services?.duration || 60;
      const bEnd = bStart + bDuration;

      // Check if overlap
      if (requestedStart < bEnd && requestedEnd > bStart) {
        availableStaffIds = availableStaffIds.filter(id => id !== b.staff_id);
      }
    });
  }

  // Verify the specific requested staff is available
  if (body.staff_id && !availableStaffIds.includes(body.staff_id)) {
    return NextResponse.json({ error: "Selected staff is not available at this time" }, { status: 400 });
  }

  if (availableStaffIds.length < partySize) {
    return NextResponse.json({ error: "Not enough staff available at this time" }, { status: 400 });
  }

  // 5. Select the required number of staff
  let selectedStaffIds = [];
  
  if (body.staff_id) {
    selectedStaffIds.push(body.staff_id);
    availableStaffIds = availableStaffIds.filter(id => id !== body.staff_id);
  }

  while (selectedStaffIds.length < partySize) {
    const randomIndex = Math.floor(Math.random() * availableStaffIds.length);
    selectedStaffIds.push(availableStaffIds[randomIndex]);
    availableStaffIds.splice(randomIndex, 1); 
  }

  // 6. Create jobs for each staff member
  const jobsToInsert = selectedStaffIds.map(staffId => ({
    ...body,
    staff_id: staffId,
    party_size: partySize // Keeping original party_size so shop knows it was a group
  }));

  const { data, error } = await supabase.from('jobs').insert(jobsToInsert);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ message: "Booking created successfully", data }, { status: 201 });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('jobs')
    .select('*, services(name, duration), users(name)')
    .eq('date', date)
    .neq('status', 'Cancelled');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}