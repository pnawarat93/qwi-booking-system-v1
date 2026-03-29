import { NextResponse } from "next/server";

const OWNER_PIN = process.env.OWNER_PIN || "1234";
const STAFF_PIN = process.env.STAFF_PIN || "5678";

export async function POST(request) {
  try {
    const { pin } = await request.json();

    if (!pin) {
      return NextResponse.json({ error: "PIN is required" }, { status: 400 });
    }

    if (pin === OWNER_PIN) {
      return NextResponse.json({ user: { id: "owner", name: "Owner", role: "owner" } });
    }

    if (pin === STAFF_PIN) {
      return NextResponse.json({ user: { id: "staff", name: "Staff", role: "staff" } });
    }

    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}