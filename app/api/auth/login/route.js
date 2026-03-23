import { NextResponse } from "next/server";

const OWNER_PIN = process.env.OWNER_PIN || "1234";

export async function POST(request) {
  try {
    const { pin } = await request.json();

    if (!pin) {
      return NextResponse.json({ error: "PIN is required" }, { status: 400 });
    }

    if (pin !== OWNER_PIN) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }


    return NextResponse.json({ user: { id: "owner", name: "Owner", role: "owner" } });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}