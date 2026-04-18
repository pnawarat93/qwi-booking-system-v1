import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

export async function GET(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const [{ data: report, error: reportError }, { data: rows, error: rowsError }] =
      await Promise.all([
        supabase
          .from("store_day_reports")
          .select(`
            id,
            store_id,
            day_date,
            store_day_id,
            start_till,
            end_till,
            total_jobs,
            paid_jobs,
            pending_jobs,
            cancelled_jobs,
            no_show_jobs,
            outstanding,
            net_revenue,
            total_staff_payout,
            store_keeps,
            cash_total,
            card_total,
            hicaps_total,
            transfer_total,
            other_total,
            payments_total,
            refunds_total,
            deposits_total,
            cancellation_fees_total,
            voids_total,
            created_at,
            closed_at,
            notes
          `)
          .eq("store_id", store.id)
          .eq("day_date", date)
          .maybeSingle(),

        supabase
          .from("store_day_report_rows")
          .select(`
            id,
            store_day_report_id,
            store_id,
            day_date,
            job_id,
            job_group_id,
            row_order,
            customer_name,
            service_name,
            start_time,
            end_time,
            duration,
            status,
            staff_id,
            staff_name,
            service_price,
            cash,
            card,
            hicaps,
            transfer,
            other,
            payment_total,
            refund_total,
            effective_total,
            staff_payout,
            payment_staff_note,
            payment_reference_code,
            notes,
            created_at
          `)
          .eq("store_id", store.id)
          .eq("day_date", date)
          .order("row_order", { ascending: true })
          .order("id", { ascending: true }),
      ]);

    if (reportError) {
      return NextResponse.json({ error: reportError.message }, { status: 500 });
    }

    if (rowsError) {
      return NextResponse.json({ error: rowsError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        store_id: store.id,
        date,
        report: report || null,
        rows: Array.isArray(rows) ? rows : [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/s/[slug]/reports error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}