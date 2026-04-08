import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { job_id, jobgroup_id, cash, card, hicaps, other } = body;
    
    if (!job_id && !jobgroup_id) {
      return NextResponse.json(
        { error: "Missing job_id or jobgroup_id" },
        { status: 400 }
      );
    }

    // insert payment record
    const paymentPayload = {
      job_id: job_id || null,
      job_group_id: jobgroup_id || null,
      cash: parseFloat(cash) || 0,
      card: parseFloat(card) || 0,
      hicaps: parseFloat(hicaps) || 0,
      other: parseFloat(other) || 0,
    };

    const { data: paymentData, error: paymentError } = await supabase
      .from("payments")
      .insert(paymentPayload)
      .select("*")
      .single();

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }

    // update job(s) to paid
    if (jobgroup_id) {
      const { error: updateGroupError } = await supabase
        .from("jobs")
        .update({ status: "paid" })
        .eq("job_group_id", jobgroup_id);

      if (updateGroupError) {
        return NextResponse.json(
          { error: updateGroupError.message },
          { status: 500 }
        );
      }
    } else if (job_id) {
      const { error: updateJobError } = await supabase
        .from("jobs")
        .update({ status: "paid" })
        .eq("id", job_id);

      if (updateJobError) {
        return NextResponse.json(
          { error: updateJobError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { message: "Payment recorded successfully", data: paymentData },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}