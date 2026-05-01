import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

function normalizeNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function totalAmount(row) {
  return (
    Number(row?.cash || 0) +
    Number(row?.card || 0) +
    Number(row?.hicaps || 0) +
    Number(row?.transfer || 0) +
    Number(row?.other || 0)
  );
}

/* =========================
   LOCK AFTER END DAY
========================= */

async function getStoreDayLockStatus(storeId, date) {
  if (!storeId || !date) {
    return {
      locked: false,
      reason: null,
    };
  }

  const [
    { data: storeDay, error: storeDayError },
    { data: existingReport, error: reportError },
  ] = await Promise.all([
    supabase
      .from("store_days")
      .select("id, store_id, day_date, is_open, closed_at")
      .eq("store_id", storeId)
      .eq("day_date", date)
      .maybeSingle(),

    supabase
      .from("store_day_reports")
      .select("id, store_id, day_date, closed_at")
      .eq("store_id", storeId)
      .eq("day_date", date)
      .maybeSingle(),
  ]);

  if (storeDayError) {
    throw new Error(storeDayError.message);
  }

  if (reportError) {
    throw new Error(reportError.message);
  }

  if (storeDay?.closed_at || existingReport) {
    return {
      locked: true,
      reason:
        "This day has already been closed. Payment changes are locked after End Day.",
    };
  }

  return {
    locked: false,
    reason: null,
  };
}

async function getJobDateForPaymentTarget({ storeId, job_id, jobgroup_id }) {
  if (jobgroup_id) {
    const { data, error } = await supabase
      .from("jobs")
      .select("date")
      .eq("store_id", storeId)
      .eq("job_group_id", jobgroup_id)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data?.date || null;
  }

  if (job_id) {
    const { data, error } = await supabase
      .from("jobs")
      .select("date")
      .eq("store_id", storeId)
      .eq("id", job_id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data?.date || null;
  }

  return null;
}

async function getPaymentTargetDate({ storeId, payment }) {
  if (!payment) return null;

  return await getJobDateForPaymentTarget({
    storeId,
    job_id: payment.job_id,
    jobgroup_id: payment.job_group_id,
  });
}

async function assertPaymentTargetIsNotLocked({ storeId, job_id, jobgroup_id }) {
  const targetDate = await getJobDateForPaymentTarget({
    storeId,
    job_id,
    jobgroup_id,
  });

  const lock = await getStoreDayLockStatus(storeId, targetDate);

  if (lock.locked) {
    return {
      locked: true,
      error: lock.reason,
    };
  }

  return {
    locked: false,
    error: null,
  };
}

async function assertPaymentRowIsNotLocked({ storeId, payment }) {
  const targetDate = await getPaymentTargetDate({ storeId, payment });
  const lock = await getStoreDayLockStatus(storeId, targetDate);

  if (lock.locked) {
    return {
      locked: true,
      error: lock.reason,
    };
  }

  return {
    locked: false,
    error: null,
  };
}

async function getLatestActivePayment({ storeId, job_id, jobgroup_id }) {
  let query = supabase
    .from("payments")
    .select("*")
    .eq("store_id", storeId)
    .eq("transaction_type", "payment")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (jobgroup_id) {
    query = query.eq("job_group_id", jobgroup_id);
  } else {
    query = query.eq("job_id", job_id);
  }

  const { data, error } = await query.maybeSingle();
  return { data, error };
}

export async function GET(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const job_id = searchParams.get("job_id");
    const jobgroup_id = searchParams.get("jobgroup_id");

    if (!job_id && !jobgroup_id) {
      return NextResponse.json(
        { error: "Missing job_id or jobgroup_id" },
        { status: 400 }
      );
    }

    const { data: payment, error } = await getLatestActivePayment({
      storeId: store.id,
      job_id,
      jobgroup_id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let refunds = [];
    let refundedTotal = 0;
    let remainingRefundable = payment ? totalAmount(payment) : 0;

    if (payment?.id) {
      const { data: refundRows, error: refundError } = await supabase
        .from("payments")
        .select("*")
        .eq("store_id", store.id)
        .eq("transaction_type", "refund")
        .eq("status", "active")
        .eq("parent_payment_id", payment.id)
        .order("created_at", { ascending: false });

      if (refundError) {
        return NextResponse.json(
          { error: refundError.message },
          { status: 500 }
        );
      }

      refunds = Array.isArray(refundRows) ? refundRows : [];
      refundedTotal = refunds.reduce((sum, row) => sum + totalAmount(row), 0);
      remainingRefundable = Math.max(totalAmount(payment) - refundedTotal, 0);
    }

    return NextResponse.json(
      {
        payment: payment || null,
        refunds,
        refundedTotal,
        remainingRefundable,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/s/[slug]/payments error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      job_id,
      jobgroup_id,
      cash,
      card,
      hicaps,
      transfer,
      other,
      notes,
      staff_note,
      reference_code,
      transaction_type = "payment",
      parent_payment_id,
    } = body;

    // REFUND FLOW
    if (transaction_type === "refund") {
      if (!parent_payment_id) {
        return NextResponse.json(
          { error: "parent_payment_id is required for refund" },
          { status: 400 }
        );
      }

      const { data: parentPayment, error: parentError } = await supabase
        .from("payments")
        .select("*")
        .eq("id", parent_payment_id)
        .eq("store_id", store.id)
        .single();

      if (parentError) {
        return NextResponse.json(
          { error: parentError.message },
          { status: 500 }
        );
      }

      if (!parentPayment) {
        return NextResponse.json(
          { error: "Parent payment not found" },
          { status: 404 }
        );
      }

      const parentLock = await assertPaymentRowIsNotLocked({
        storeId: store.id,
        payment: parentPayment,
      });

      if (parentLock.locked) {
        return NextResponse.json(
          { error: parentLock.error || "This day is closed. Cannot refund." },
          { status: 423 }
        );
      }

      if (parentPayment.transaction_type !== "payment") {
        return NextResponse.json(
          { error: "Refund must reference a payment transaction" },
          { status: 400 }
        );
      }

      if (parentPayment.status !== "active") {
        return NextResponse.json(
          { error: "Cannot refund inactive payment" },
          { status: 400 }
        );
      }

      const refundPayload = {
        job_id: parentPayment.job_id,
        job_group_id: parentPayment.job_group_id,
        cash: normalizeNumber(cash),
        card: normalizeNumber(card),
        hicaps: normalizeNumber(hicaps),
        transfer: normalizeNumber(transfer),
        other: normalizeNumber(other),
        transaction_type: "refund",
        status: "active",
        parent_payment_id,
        notes: notes || "Refund from booking details modal",
        staff_note: null,
        reference_code: null,
        store_id: store.id,
      };

      const refundTotal = totalAmount(refundPayload);
      if (refundTotal <= 0) {
        return NextResponse.json(
          { error: "Refund amount must be greater than 0" },
          { status: 400 }
        );
      }

      const { data: existingRefunds, error: existingRefundsError } =
        await supabase
          .from("payments")
          .select("*")
          .eq("store_id", store.id)
          .eq("transaction_type", "refund")
          .eq("status", "active")
          .eq("parent_payment_id", parent_payment_id);

      if (existingRefundsError) {
        return NextResponse.json(
          { error: existingRefundsError.message },
          { status: 500 }
        );
      }

      const refundedTotal = (existingRefunds || []).reduce(
        (sum, row) => sum + totalAmount(row),
        0
      );

      const parentTotal = totalAmount(parentPayment);
      const remainingRefundable = Math.max(parentTotal - refundedTotal, 0);

      if (refundTotal > remainingRefundable) {
        return NextResponse.json(
          {
            error: `Refund exceeds remaining refundable amount. Remaining: $${remainingRefundable.toFixed(
              2
            )}`,
          },
          { status: 400 }
        );
      }

      const { data: refundRow, error: refundError } = await supabase
        .from("payments")
        .insert(refundPayload)
        .select("*")
        .single();

      if (refundError) {
        return NextResponse.json(
          { error: refundError.message },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { message: "Refund recorded", data: refundRow },
        { status: 201 }
      );
    }

    // NORMAL PAYMENT FLOW
    if (!job_id && !jobgroup_id) {
      return NextResponse.json(
        { error: "Missing job_id or jobgroup_id" },
        { status: 400 }
      );
    }

    const paymentTargetLock = await assertPaymentTargetIsNotLocked({
      storeId: store.id,
      job_id,
      jobgroup_id,
    });

    if (paymentTargetLock.locked) {
      return NextResponse.json(
        {
          error:
            paymentTargetLock.error ||
            "This day is closed. Cannot record payment.",
        },
        { status: 423 }
      );
    }

    const { data: existingPayment, error: existingPaymentError } =
      await getLatestActivePayment({
        storeId: store.id,
        job_id,
        jobgroup_id,
      });

    if (existingPaymentError) {
      return NextResponse.json(
        { error: existingPaymentError.message },
        { status: 500 }
      );
    }

    if (existingPayment) {
      return NextResponse.json(
        {
          error: "Active payment already exists for this booking",
          existingPayment,
        },
        { status: 409 }
      );
    }

    const paymentPayload = {
      job_id: job_id || null,
      job_group_id: jobgroup_id || null,
      cash: normalizeNumber(cash),
      card: normalizeNumber(card),
      hicaps: normalizeNumber(hicaps),
      transfer: normalizeNumber(transfer),
      other: normalizeNumber(other),
      transaction_type: "payment",
      status: "active",
      notes: notes || null,
      staff_note: staff_note || null,
      reference_code: reference_code || null,
      store_id: store.id,
    };

    const paymentDataTotal = totalAmount(paymentPayload);
    if (paymentDataTotal <= 0) {
      return NextResponse.json(
        { error: "Payment amount must be greater than 0" },
        { status: 400 }
      );
    }

    const { data: paymentData, error: paymentError } = await supabase
      .from("payments")
      .insert(paymentPayload)
      .select("*")
      .single();

    if (paymentError) {
      return NextResponse.json(
        { error: paymentError.message },
        { status: 500 }
      );
    }

    if (jobgroup_id) {
      const { error: updateGroupError } = await supabase
        .from("jobs")
        .update({ status: "paid" })
        .eq("job_group_id", jobgroup_id)
        .eq("store_id", store.id);

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
        .eq("id", job_id)
        .eq("store_id", store.id);

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
    console.error("POST /api/s/[slug]/payments error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      payment_id,
      cash,
      card,
      hicaps,
      transfer,
      other,
      notes,
      staff_note,
      reference_code,
    } = body;

    if (!payment_id) {
      return NextResponse.json(
        { error: "Missing payment_id" },
        { status: 400 }
      );
    }

    const { data: existingPayment, error: existingPaymentError } =
      await supabase
        .from("payments")
        .select("*")
        .eq("id", payment_id)
        .eq("transaction_type", "payment")
        .eq("store_id", store.id)
        .single();

    if (existingPaymentError) {
      return NextResponse.json(
        { error: existingPaymentError.message },
        { status: 500 }
      );
    }

    const paymentLock = await assertPaymentRowIsNotLocked({
      storeId: store.id,
      payment: existingPayment,
    });

    if (paymentLock.locked) {
      return NextResponse.json(
        {
          error:
            paymentLock.error || "This day is closed. Cannot edit payment.",
        },
        { status: 423 }
      );
    }

    const updatePayload = {
      cash: normalizeNumber(cash),
      card: normalizeNumber(card),
      hicaps: normalizeNumber(hicaps),
      transfer: normalizeNumber(transfer),
      other: normalizeNumber(other),
      notes: notes || null,
      staff_note: staff_note || null,
      reference_code: reference_code || null,
    };

    const updatedTotal = totalAmount(updatePayload);
    if (updatedTotal <= 0) {
      return NextResponse.json(
        { error: "Payment amount must be greater than 0" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("payments")
      .update(updatePayload)
      .eq("id", payment_id)
      .eq("transaction_type", "payment")
      .eq("store_id", store.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { message: "Payment updated successfully", data },
      { status: 200 }
    );
  } catch (error) {
    console.error("PATCH /api/s/[slug]/payments error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const body = await request.json();
    const { payment_id } = body;

    if (!payment_id) {
      return NextResponse.json(
        { error: "Missing payment_id" },
        { status: 400 }
      );
    }

    const { data: paymentRow, error: fetchError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", payment_id)
      .eq("store_id", store.id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const paymentLock = await assertPaymentRowIsNotLocked({
      storeId: store.id,
      payment: paymentRow,
    });

    if (paymentLock.locked) {
      return NextResponse.json(
        {
          error:
            paymentLock.error || "This day is closed. Cannot void payment.",
        },
        { status: 423 }
      );
    }

    if (paymentRow.transaction_type !== "payment") {
      return NextResponse.json(
        { error: "Only payment transactions can be voided here" },
        { status: 400 }
      );
    }

    const { data: voidRow, error: voidError } = await supabase
      .from("payments")
      .insert({
        job_id: paymentRow.job_id,
        job_group_id: paymentRow.job_group_id,
        cash: paymentRow.cash,
        card: paymentRow.card,
        hicaps: paymentRow.hicaps,
        transfer: paymentRow.transfer,
        other: paymentRow.other,
        transaction_type: "void",
        status: "active",
        parent_payment_id: paymentRow.id,
        notes: "Voided from booking details modal",
        staff_note: null,
        reference_code: null,
        store_id: store.id,
      })
      .select("*")
      .single();

    if (voidError) {
      return NextResponse.json({ error: voidError.message }, { status: 500 });
    }

    const { error: markVoidedError } = await supabase
      .from("payments")
      .update({ status: "voided" })
      .eq("id", paymentRow.id)
      .eq("store_id", store.id);

    if (markVoidedError) {
      return NextResponse.json(
        { error: markVoidedError.message },
        { status: 500 }
      );
    }

    if (paymentRow?.job_group_id) {
      const { error: updateGroupError } = await supabase
        .from("jobs")
        .update({ status: "pending" })
        .eq("job_group_id", paymentRow.job_group_id)
        .eq("store_id", store.id);

      if (updateGroupError) {
        return NextResponse.json(
          { error: updateGroupError.message },
          { status: 500 }
        );
      }
    } else if (paymentRow?.job_id) {
      const { error: updateJobError } = await supabase
        .from("jobs")
        .update({ status: "pending" })
        .eq("id", paymentRow.job_id)
        .eq("store_id", store.id);

      if (updateJobError) {
        return NextResponse.json(
          { error: updateJobError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { message: "Payment voided successfully", data: voidRow },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/s/[slug]/payments error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}