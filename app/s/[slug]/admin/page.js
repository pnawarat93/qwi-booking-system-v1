"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  ClipboardList,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

import StoreInfoBar from "@/app/components/StoreInfoBar";
import ScheduleToolbar from "@/app/components/ScheduleToolbar";
import ScheduleGrid from "@/app/components/ScheduleGrid";
import BottomDayTray from "@/app/components/BottomDayTray";
import EndDayReport from "@/app/components/EndDayReport";
import AddWalkInModal from "@/app/components/AddWalkInModal";
import NewBookingModal from "@/app/components/NewBookingModal";
import InactiveBookingsModal from "@/app/components/InactiveBookingsModal";
import UnassignedBookingsModal from "@/app/components/UnassignedBookingsModal";
import StaffControlsModal from "@/app/components/StaffControlsModal";
import StartDayModal from "@/app/components/StartDayModal";

import useAuthStore from "@/store/useAuthStore";
import { useStore } from "../StoreContext";
import { getStoreFeatures } from "@/lib/config/features";
import { storeApiUrl } from "@/lib/storeApi";

function getTodayInTimeZone(timeZone = "Australia/Sydney") {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

function formatClosedAt(value, timeZone = "Australia/Sydney") {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-AU", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

const FRONT_DESK_LOCALE_STORAGE_KEY = "keenie:front-desk-locale";

const FRONT_DESK_COPY = {
  en: {
    header: {
      ownerDashboard: "Owner Dashboard",
    },
    toolbar: {
      goToday: "Go to Today",
      addWalkIn: "Add Walk-in",
      newBooking: "New Booking",
    },
    sidebar: {
      newBooking: "New Booking",
      addWalkIn: "Add Walk-in",
      staffControls: "Staff Controls",
      ownerDashboard: "Owner Dashboard",
    },
    states: {
      storeClosed: "Store closed",
      storeClosedTitle: "Store closed for this day",
      recordsFinalized: "Today's records are finalized. Front desk actions are locked for this date.",
      allRecordsFinalized: "All records for this day have been finalized and saved.",
      finalized: "Finalized",
      endDayUnavailable: "End Day unavailable",
      loadingDayStatus: "Loading day status...",
      dayNotStarted: "Day not started",
      startBeforeBookings:
        "Start this day before taking bookings or closing the day.",
      startDay: "Start Day",
    },
    tray: {
      active: "Active",
      total: "Total",
      inactive: "Inactive",
      unassigned: "Unassigned",
      startTill: "Start Till",
      cashTill: "Cash Till",
      staffControls: "Staff Controls",
      endOfDayReport: "End of Day Report",
    },
    alerts: {
      bookingSingular: "booking",
      bookingPlural: "bookings",
      needsReassignment: "need reassignment",
      pendingWithoutStaff:
        "These are pending bookings without an active staff.",
      reviewUnassigned: "Review unassigned",
      paidBookingSingular: "paid booking",
      paidBookingPlural: "paid bookings",
      linkedToMissingStaff: "linked to staff not on today's grid",
      checkOngoing:
        "Check if the service is still ongoing or staff has changed.",
    },
    modals: {
      addWalkIn: {
        title: "Add walk-in",
        subtitle: "Add one walk-in customer to the schedule.",
        customerName: "Customer name",
        phone: "Phone",
        service: "Service",
        time: "Time",
        staff: "Staff",
        date: "Date",
        selectService: "Select service",
        selectServiceFirst: "Select service first",
        selectTimeFirst: "Select time first",
        noStaffAvailable: "No staff available",
        selectStaff: "Select staff",
        storeClosed: "Store is closed on this date.",
        chooseAnotherDate: "Please choose another date.",
        hoursForDate: "Hours for this date",
        onePerson: "One person per walk-in",
        onePersonHelper:
          "If two people arrive together, add the second walk-in separately.",
        staffHelper:
          "Staff options are calculated from the selected service and time.",
        walkInCustomer: "Walk-in customer",
        optional: "Optional",
        close: "Close",
        cancel: "Cancel",
        saving: "Saving...",
        submit: "Add walk-in",
      },
      newBooking: {
        title: "New booking",
        subtitle: "Create a phone or future appointment for the schedule.",
        customer: "Customer",
        customerHelper: "Details for the person making the booking.",
        appointment: "Appointment",
        appointmentHelper: "Choose the service, time, and preferred staff.",
        notes: "Notes",
        customerName: "Customer name",
        phone: "Phone",
        service: "Service",
        date: "Date",
        time: "Time",
        staff: "Staff",
        partySize: "Party size",
        selectService: "Select service",
        autoAssign: "Auto assign available staff",
        staffHelper:
          "Keenie will choose available staff based on today's grid order.",
        optionalNote: "Optional request or phone note",
        storeClosed: "Store is closed on this date.",
        chooseAnotherDate: "Please choose another date.",
        hoursForDate: "Hours for this date",
        phoneNumber: "Phone number",
        close: "Close",
        cancel: "Cancel",
        saving: "Saving...",
        submit: "Create booking",
      },
      bookingDetails: {
        title: "Booking details",
        close: "Close",
        bookingInformation: "Booking information",
        bookingInfoHelper: "Customer, service, and time details",
        editDetails: "Edit details",
        doneEditing: "Done editing",
        customerName: "Customer name",
        phoneNumber: "Phone number",
        serviceName: "Service name",
        durationMins: "Duration (mins)",
        customer: "Customer",
        phone: "Phone",
        service: "Service",
        duration: "Duration",
        time: "Time",
        status: "Status",
        pending: "Pending",
        paid: "Paid",
        completed: "Completed",
        cancelled: "Cancelled",
        noShow: "No-show",
        walkIn: "Walk-in",
        groupBooking: "Group booking",
        requestedStaffBooking: "Requested staff booking",
        needsReassignment: "Needs reassignment",
        fullyRefunded: "Fully refunded",
        assignedStaff: "Assigned staff",
        unassigned: "Unassigned",
        staffRequestedWarning:
          "Customer requested this staff. Reassign only if necessary.",
        staffOptionsHelper:
          "Only staff on the selected date's shift and free at this time are shown here.",
        notes: "Notes",
        internalBookingNote: "Internal booking note",
        internalNotePlaceholder: "Internal note for this booking",
        cancel: "Cancel",
        saveChanges: "Save changes",
        saving: "Saving...",
        unsavedChanges: "Unsaved changes",
        noChangesYet: "No changes yet",
        updateProgress: "Update booking progress",
      },
      startDay: {
        title: "Start Day",
        openDay: "Open Day",
        startThisDay: "Start this day",
        eyebrow: "Start of day",
        confirmOpening: "Confirm today's opening",
        liteIntro: "Review business hours and staff before opening the grid.",
        proIntro:
          "Review the opening till, staff order, and daily guarantees before opening the grid.",
        store: "Store",
        date: "Date",
        businessHours: "Business hours",
        storeHours: "Store hours",
        closed: "Closed",
        defaultGuarantee: "Default guarantee",
        startingTill: "Starting till",
        startingTillAmount: "Starting till amount",
        openingNote: "Opening note (optional)",
        staffSetup: "Staff setup",
        todaysGridOrder: "Today's grid order",
        staffWorkingToday: "Staff working today",
        availableStaff: "Available staff",
        noStaffScheduled: "No staff scheduled",
        noStaffSelected: "No staff selected for today yet.",
        addStaff: "Add staff",
        hideAddStaff: "Hide add staff",
        addExistingStaff: "Add existing staff",
        addTemporaryStaff: "Add temporary staff",
        addTemporaryCasual: "Add temporary / casual",
        hideQuickAdd: "Hide quick add",
        remove: "Remove",
        dailyGuarantee: "Daily guarantee",
        guarantee: "Guarantee",
        effective: "Effective",
        staffRole: "Staff role",
        loading: "Loading...",
        close: "Close",
        cancel: "Cancel",
        saving: "Saving...",
        confirming: "Confirming...",
        confirmStartDay: "Confirm Start Day",
        openGrid: "Open the grid",
        readyToOpen: "Ready to open",
        storeClosed: "Store closed",
        noBusinessHoursFound: "No business hours found",
        outsideBusinessHours: "This date is outside business hours",
        noStaffCode: "No staff code",
        noMoreStaffAvailable: "No more staff available to add.",
        displayName: "Display name",
        staffCode: "Staff code",
        noStaffRoleSelected: "No staff role selected",
        staffRoleHelper: "Staff role controls payout calculation.",
        createAndAdd: "Create and add",
        creating: "Creating...",
      },
      endDay: {
        title: "End of Day Report",
        close: "Close",
        liteSubtitle: "Review today's operations before closing the day.",
        proSubtitle: "Review today's records before closing store operations.",
        loadingSummary: "Loading end of day summary...",
        pendingBookingsStillExist: "Pending bookings still exist",
        pendingBookingsWarning:
          "All active bookings must be finalized before the store can be closed. Please finish or close each pending booking first.",
        cannotFinalizePending:
          "Cannot finalize day while pending bookings still exist. Please finalize all pending bookings first.",
        finalizeBookingsFirst: "Finalize these bookings first to continue.",
        estimatedRevenue: "Estimated Revenue",
        completedJobs: "Completed Jobs",
        cancelled: "Cancelled",
        noShow: "No Show",
        staffActivitySummary: "Staff Activity Summary",
        staff: "Staff",
        completed: "Completed",
        estimatedValue: "Estimated Value",
        noStaffActivity: "No staff activity for this day.",
        closingNote: "Closing note",
        closingNoteHelper:
          "Confirm the day once bookings have been reviewed and any outstanding operational tasks are complete.",
        backToGrid: "Back to Grid",
        finalizeDay: "Finalize Day",
        finalizing: "Finalizing...",
        pendingBookingsExist: "Pending Bookings Exist",
        pending: "Pending",
        finalizeAndLock: "Finalize and lock this day?",
        liteFinalizeWarning:
          "After this day is finalized, front desk can no longer edit bookings, staff assignment, or notes for this date.",
        proFinalizeWarning:
          "After this day is finalized, front desk can no longer edit bookings, payments, refunds, staff assignment, or notes for this date.",
        cannotChange:
          "This action cannot be changed from the front desk.",
        goBack: "Go back",
        yesFinalizeDay: "Yes, finalize day",
        paidJobs: "Paid Jobs",
        netRevenue: "Net Revenue",
        totalStaffPayout: "Total Staff Payout",
        storeKeeps: "Store Keeps",
        startTill: "Start Till",
        expectedCashInTill: "Expected Cash in Till",
        paymentBreakdown: "Payment Breakdown",
        transactionSummary: "Transaction Summary",
        payments: "Payments",
        refunds: "Refunds",
        deposits: "Deposits",
        voids: "Voids",
        staffPayouts: "Staff Payouts",
        policy: "Policy",
        gross: "Gross",
        effective: "Effective",
        payout: "Payout",
        noStaffPayoutData: "No staff payout data for this day.",
        fullRefunds: "Full Refunds",
        noPolicy: "No policy",
      },
      staffControls: {
        title: "Staff controls",
        manageWorkingOn: "Manage who is working on",
        dateSuffix: ".",
        close: "Close",
        todaysStaff: "Today's staff",
        staffMarkedOffHelper:
          "Staff marked off remain visible for payout and guarantee adjustments.",
        liteStaffHelper: "Staff can be switched on or off for today's grid.",
        addStaff: "Add staff",
        addTemporaryCasual: "Add temporary / casual",
        addTemporaryStaff: "Add temporary staff",
        hideAddStaff: "Hide add staff",
        hideQuickAdd: "Hide quick add",
        loading: "Loading...",
        noStaffOnDate: "No staff on this date yet.",
        off: "Off",
        noStaffCode: "No staff code",
        guarantee: "Guarantee",
        effective: "Effective",
        saving: "Saving...",
        setOff: "Set off",
        setWorking: "Set working",
        addExistingStaff: "Add existing staff",
        noMoreStaffAvailable: "No more staff available to add.",
        adding: "Adding...",
        add: "Add",
        quickAddTemporary: "Quick add temporary / casual staff",
        displayName: "Display name",
        staffCodeOptional: "Staff code (optional)",
        staffRole: "Staff role",
        noRoleSelected: "No role selected",
        optionalRoleHelper: "Optional. Staff payout will use this role.",
        guaranteeToday: "Guarantee today (optional)",
        defaultGuaranteeHelper: "Leave empty to use default guarantee.",
        createAndAdd: "Create and add",
        creating: "Creating...",
        emptyActionHelperBefore: "Use",
        emptyActionHelperMiddle: "for existing staff, or",
        emptyActionHelperAfter: "for last-minute coverage.",
        displayNameRequired: "Please enter a display name.",
      },
    },
  },
  th: {
    header: {
      ownerDashboard: "หน้าเจ้าของร้าน",
    },
    toolbar: {
      goToday: "ไปวันนี้",
      addWalkIn: "เพิ่ม Walk-in",
      newBooking: "สร้าง Booking",
    },
    sidebar: {
      newBooking: "สร้าง Booking",
      addWalkIn: "เพิ่ม Walk-in",
      staffControls: "จัดการพนักงาน",
      ownerDashboard: "หน้าเจ้าของร้าน",
    },
    states: {
      storeClosed: "ปิดร้านแล้ว",
      storeClosedTitle: "วันนี้ปิดร้านแล้ว",
      recordsFinalized:
        "บันทึกของวันนี้เสร็จสมบูรณ์แล้ว การทำงานหน้า Front Desk ถูกล็อกสำหรับวันนี้",
      allRecordsFinalized: "บันทึกของวันนี้ถูกสรุปและบันทึกเรียบร้อยแล้ว",
      finalized: "สรุปแล้ว",
      endDayUnavailable: "ยังปิดวันไม่ได้",
      loadingDayStatus: "กำลังโหลดสถานะวัน...",
      dayNotStarted: "ยังไม่ได้เริ่มวัน",
      startBeforeBookings: "เริ่มวันนี้ก่อนรับ Booking หรือปิดวัน",
      startDay: "เริ่มวัน",
    },
    tray: {
      active: "งานเปิดอยู่",
      total: "ทั้งหมด",
      inactive: "ไม่ใช้งาน",
      unassigned: "ยังไม่มอบหมาย",
      startTill: "เงินเริ่มต้น",
      cashTill: "เงินสดในลิ้นชัก",
      staffControls: "จัดการพนักงาน",
      endOfDayReport: "รายงานปิดวัน",
    },
    alerts: {
      bookingSingular: "Booking",
      bookingPlural: "Booking",
      needsReassignment: "ต้องมอบหมายใหม่",
      pendingWithoutStaff: "รายการเหล่านี้ยังไม่มีพนักงานที่ใช้งานอยู่",
      reviewUnassigned: "ตรวจสอบรายการที่ยังไม่มอบหมาย",
      paidBookingSingular: "Booking ที่ชำระแล้ว",
      paidBookingPlural: "Booking ที่ชำระแล้ว",
      linkedToMissingStaff: "เชื่อมกับพนักงานที่ไม่ได้อยู่บนตารางวันนี้",
      checkOngoing:
        "ตรวจสอบว่าบริการยังดำเนินอยู่ หรือมีการเปลี่ยนพนักงานหรือไม่",
    },
    modals: {
      addWalkIn: {
        title: "เพิ่ม Walk-in",
        subtitle: "เพิ่มลูกค้า Walk-in หนึ่งคนลงในตาราง",
        customerName: "ชื่อลูกค้า",
        phone: "เบอร์โทร",
        service: "บริการ",
        time: "เวลา",
        staff: "พนักงาน",
        date: "วันที่",
        selectService: "เลือกบริการ",
        selectServiceFirst: "เลือกบริการก่อน",
        selectTimeFirst: "เลือกเวลาก่อน",
        noStaffAvailable: "ไม่มีพนักงานว่าง",
        selectStaff: "เลือกพนักงาน",
        storeClosed: "ร้านปิดในวันนี้",
        chooseAnotherDate: "กรุณาเลือกวันอื่น",
        hoursForDate: "เวลาทำการวันนี้",
        onePerson: "Walk-in หนึ่งรายการต่อหนึ่งคน",
        onePersonHelper: "ถ้ามาสองคนพร้อมกัน ให้เพิ่ม Walk-in คนที่สองแยกต่างหาก",
        staffHelper: "ตัวเลือกพนักงานคำนวณจากบริการและเวลาที่เลือก",
        walkInCustomer: "ลูกค้า Walk-in",
        optional: "ไม่บังคับ",
        close: "ปิด",
        cancel: "ยกเลิก",
        saving: "กำลังบันทึก...",
        submit: "เพิ่ม Walk-in",
      },
      newBooking: {
        title: "สร้าง Booking",
        subtitle: "สร้างนัดหมายทางโทรศัพท์หรือนัดหมายล่วงหน้าลงในตาราง",
        customer: "ลูกค้า",
        customerHelper: "รายละเอียดของผู้จอง",
        appointment: "นัดหมาย",
        appointmentHelper: "เลือกบริการ เวลา และพนักงานที่ต้องการ",
        notes: "หมายเหตุ",
        customerName: "ชื่อลูกค้า",
        phone: "เบอร์โทร",
        service: "บริการ",
        date: "วันที่",
        time: "เวลา",
        staff: "พนักงาน",
        partySize: "จำนวนคน",
        selectService: "เลือกบริการ",
        autoAssign: "มอบหมายพนักงานว่างอัตโนมัติ",
        staffHelper: "Keenie จะเลือกพนักงานที่ว่างตามลำดับในตารางวันนี้",
        optionalNote: "คำขอหรือหมายเหตุทางโทรศัพท์",
        storeClosed: "ร้านปิดในวันนี้",
        chooseAnotherDate: "กรุณาเลือกวันอื่น",
        hoursForDate: "เวลาทำการวันนี้",
        phoneNumber: "เบอร์โทร",
        close: "ปิด",
        cancel: "ยกเลิก",
        saving: "กำลังบันทึก...",
        submit: "สร้าง Booking",
      },
      bookingDetails: {
        title: "รายละเอียด Booking",
        close: "ปิด",
        bookingInformation: "ข้อมูล Booking",
        bookingInfoHelper: "รายละเอียดลูกค้า บริการ และเวลา",
        editDetails: "แก้ไขรายละเอียด",
        doneEditing: "แก้ไขเสร็จแล้ว",
        customerName: "ชื่อลูกค้า",
        phoneNumber: "เบอร์โทร",
        serviceName: "ชื่อบริการ",
        durationMins: "ระยะเวลา (นาที)",
        customer: "ลูกค้า",
        phone: "เบอร์โทร",
        service: "บริการ",
        duration: "ระยะเวลา",
        time: "เวลา",
        status: "สถานะ",
        pending: "รอดำเนินการ",
        paid: "ชำระแล้ว",
        completed: "เสร็จแล้ว",
        cancelled: "ยกเลิก",
        noShow: "ไม่มา",
        walkIn: "Walk-in",
        groupBooking: "Booking กลุ่ม",
        requestedStaffBooking: "ลูกค้าขอพนักงาน",
        needsReassignment: "ต้องมอบหมายใหม่",
        fullyRefunded: "คืนเงินครบแล้ว",
        assignedStaff: "พนักงานที่รับผิดชอบ",
        unassigned: "ยังไม่มอบหมาย",
        staffRequestedWarning:
          "ลูกค้าขอพนักงานคนนี้ เปลี่ยนพนักงานเฉพาะเมื่อจำเป็น",
        staffOptionsHelper:
          "แสดงเฉพาะพนักงานที่อยู่ในกะของวันที่เลือกและว่างในเวลานี้",
        notes: "หมายเหตุ",
        internalBookingNote: "หมายเหตุภายในของ Booking",
        internalNotePlaceholder: "หมายเหตุภายในสำหรับ Booking นี้",
        cancel: "ยกเลิก",
        saveChanges: "บันทึกการเปลี่ยนแปลง",
        saving: "กำลังบันทึก...",
        unsavedChanges: "มีการเปลี่ยนแปลงที่ยังไม่บันทึก",
        noChangesYet: "ยังไม่มีการเปลี่ยนแปลง",
        updateProgress: "อัปเดตความคืบหน้าของ Booking",
      },
      startDay: {
        title: "เริ่มวัน",
        openDay: "เปิดวัน",
        startThisDay: "เริ่มวันนี้",
        eyebrow: "เริ่มต้นวัน",
        confirmOpening: "ยืนยันการเปิดวันนี้",
        liteIntro: "ตรวจสอบเวลาทำการและพนักงานก่อนเปิดตาราง",
        proIntro:
          "ตรวจสอบเงินเริ่มต้น ลำดับพนักงาน และการการันตีรายวันก่อนเปิดตาราง",
        store: "ร้าน",
        date: "วันที่",
        businessHours: "เวลาทำการ",
        storeHours: "เวลาทำการร้าน",
        closed: "ปิด",
        defaultGuarantee: "การันตีเริ่มต้น",
        startingTill: "เงินเริ่มต้น",
        startingTillAmount: "จำนวนเงินเริ่มต้น",
        openingNote: "หมายเหตุเปิดวัน (ไม่บังคับ)",
        staffSetup: "ตั้งค่าพนักงาน",
        todaysGridOrder: "ลำดับพนักงานในตารางวันนี้",
        staffWorkingToday: "พนักงานที่ทำงานวันนี้",
        availableStaff: "พนักงานที่พร้อมเพิ่ม",
        noStaffScheduled: "ยังไม่มีพนักงานในตาราง",
        noStaffSelected: "ยังไม่ได้เลือกพนักงานสำหรับวันนี้",
        addStaff: "เพิ่มพนักงาน",
        hideAddStaff: "ซ่อนเพิ่มพนักงาน",
        addExistingStaff: "เพิ่มพนักงานที่มีอยู่",
        addTemporaryStaff: "เพิ่มพนักงานชั่วคราว",
        addTemporaryCasual: "เพิ่มพนักงานชั่วคราว / casual",
        hideQuickAdd: "ซ่อนเพิ่มด่วน",
        remove: "ลบ",
        dailyGuarantee: "การันตีรายวัน",
        guarantee: "การันตี",
        effective: "ใช้จริง",
        staffRole: "บทบาทพนักงาน",
        loading: "กำลังโหลด...",
        close: "ปิด",
        cancel: "ยกเลิก",
        saving: "กำลังบันทึก...",
        confirming: "กำลังยืนยัน...",
        confirmStartDay: "ยืนยันเริ่มวัน",
        openGrid: "เปิดตาราง",
        readyToOpen: "พร้อมเปิด",
        storeClosed: "ร้านปิด",
        noBusinessHoursFound: "ไม่พบเวลาทำการ",
        outsideBusinessHours: "วันนี้อยู่นอกเวลาทำการ",
        noStaffCode: "ไม่มีรหัสพนักงาน",
        noMoreStaffAvailable: "ไม่มีพนักงานให้เพิ่มแล้ว",
        displayName: "ชื่อที่แสดง",
        staffCode: "รหัสพนักงาน",
        noStaffRoleSelected: "ยังไม่ได้เลือกบทบาทพนักงาน",
        staffRoleHelper: "บทบาทพนักงานใช้ควบคุมการคำนวณ payout",
        createAndAdd: "สร้างและเพิ่ม",
        creating: "กำลังสร้าง...",
      },
      endDay: {
        title: "รายงานปิดวัน",
        close: "ปิด",
        liteSubtitle: "ตรวจสอบการทำงานของวันนี้ก่อนปิดวัน",
        proSubtitle: "ตรวจสอบบันทึกของวันนี้ก่อนปิดการทำงานของร้าน",
        loadingSummary: "กำลังโหลดสรุปปิดวัน...",
        pendingBookingsStillExist: "ยังมี Booking ที่รอดำเนินการ",
        pendingBookingsWarning:
          "ต้องสรุป Booking ที่ยังเปิดอยู่ทั้งหมดก่อนปิดร้าน กรุณาทำให้เสร็จหรือปิด Booking ที่รอดำเนินการก่อน",
        cannotFinalizePending:
          "ยังสรุปปิดวันไม่ได้ เพราะยังมี Booking ที่รอดำเนินการ กรุณาสรุป Booking ที่รอดำเนินการทั้งหมดก่อน",
        finalizeBookingsFirst: "สรุป Booking เหล่านี้ก่อนจึงจะดำเนินการต่อได้",
        estimatedRevenue: "รายได้โดยประมาณ",
        completedJobs: "งานที่เสร็จแล้ว",
        cancelled: "ยกเลิก",
        noShow: "ไม่มา",
        staffActivitySummary: "สรุปกิจกรรมพนักงาน",
        staff: "พนักงาน",
        completed: "เสร็จแล้ว",
        estimatedValue: "มูลค่าโดยประมาณ",
        noStaffActivity: "ไม่มีข้อมูลกิจกรรมพนักงานสำหรับวันนี้",
        closingNote: "หมายเหตุปิดวัน",
        closingNoteHelper:
          "ยืนยันปิดวันเมื่อได้ตรวจสอบ Booking และงานค้างอื่น ๆ เรียบร้อยแล้ว",
        backToGrid: "กลับไปที่ตาราง",
        finalizeDay: "สรุปปิดวัน",
        finalizing: "กำลังสรุป...",
        pendingBookingsExist: "ยังมี Booking ที่รอดำเนินการ",
        pending: "รอดำเนินการ",
        finalizeAndLock: "สรุปและล็อกวันนี้?",
        liteFinalizeWarning:
          "หลังจากสรุปวันนี้แล้ว Front Desk จะไม่สามารถแก้ไข Booking การมอบหมายพนักงาน หรือหมายเหตุของวันนี้ได้อีก",
        proFinalizeWarning:
          "หลังจากสรุปวันนี้แล้ว Front Desk จะไม่สามารถแก้ไข Booking การชำระเงิน การคืนเงิน การมอบหมายพนักงาน หรือหมายเหตุของวันนี้ได้อีก",
        cannotChange: "การกระทำนี้ไม่สามารถเปลี่ยนจาก Front Desk ได้",
        goBack: "ย้อนกลับ",
        yesFinalizeDay: "ใช่ สรุปปิดวัน",
        paidJobs: "งานที่ชำระแล้ว",
        netRevenue: "รายได้สุทธิ",
        totalStaffPayout: "ยอดจ่ายพนักงานรวม",
        storeKeeps: "ร้านคงเหลือ",
        startTill: "เงินเริ่มต้น",
        expectedCashInTill: "เงินสดที่ควรมีในลิ้นชัก",
        paymentBreakdown: "แยกตามวิธีชำระเงิน",
        transactionSummary: "สรุปรายการธุรกรรม",
        payments: "การชำระเงิน",
        refunds: "การคืนเงิน",
        deposits: "เงินมัดจำ",
        voids: "รายการยกเลิก",
        staffPayouts: "ยอดจ่ายพนักงาน",
        policy: "นโยบาย",
        gross: "ยอดรวม",
        effective: "ยอดสุทธิที่ใช้คำนวณ",
        payout: "ยอดจ่าย",
        noStaffPayoutData: "ไม่มีข้อมูลยอดจ่ายพนักงานสำหรับวันนี้",
        fullRefunds: "คืนเงินเต็มจำนวน",
        noPolicy: "ไม่มีนโยบาย",
      },
      staffControls: {
        title: "จัดการพนักงาน",
        manageWorkingOn: "จัดการพนักงานที่ทำงานวันที่",
        dateSuffix: "",
        close: "ปิด",
        todaysStaff: "พนักงานวันนี้",
        staffMarkedOffHelper:
          "พนักงานที่ถูกปิดยังแสดงอยู่ เพื่อปรับ payout และการันตีได้",
        liteStaffHelper: "เปิดหรือปิดพนักงานสำหรับตารางวันนี้ได้",
        addStaff: "เพิ่มพนักงาน",
        addTemporaryCasual: "เพิ่มพนักงานชั่วคราว / casual",
        addTemporaryStaff: "เพิ่มพนักงานชั่วคราว",
        hideAddStaff: "ซ่อนเพิ่มพนักงาน",
        hideQuickAdd: "ซ่อนเพิ่มด่วน",
        loading: "กำลังโหลด...",
        noStaffOnDate: "ยังไม่มีพนักงานในวันนี้",
        off: "ปิด",
        noStaffCode: "ไม่มีรหัสพนักงาน",
        guarantee: "การันตี",
        effective: "ใช้จริง",
        saving: "กำลังบันทึก...",
        setOff: "ตั้งเป็นไม่ทำงาน",
        setWorking: "ตั้งเป็นทำงาน",
        addExistingStaff: "เพิ่มพนักงานที่มีอยู่",
        noMoreStaffAvailable: "ไม่มีพนักงานให้เพิ่มแล้ว",
        adding: "กำลังเพิ่ม...",
        add: "เพิ่ม",
        quickAddTemporary: "เพิ่มพนักงานชั่วคราว / casual แบบด่วน",
        displayName: "ชื่อที่แสดง",
        staffCodeOptional: "รหัสพนักงาน (ไม่บังคับ)",
        staffRole: "บทบาทพนักงาน",
        noRoleSelected: "ยังไม่ได้เลือกบทบาท",
        optionalRoleHelper: "ไม่บังคับ ระบบจะใช้บทบาทนี้ในการคำนวณ payout",
        guaranteeToday: "การันตีวันนี้ (ไม่บังคับ)",
        defaultGuaranteeHelper: "เว้นว่างเพื่อใช้การันตีเริ่มต้น",
        createAndAdd: "สร้างและเพิ่ม",
        creating: "กำลังสร้าง...",
        emptyActionHelperBefore: "ใช้",
        emptyActionHelperMiddle: "สำหรับพนักงานที่มีอยู่ หรือ",
        emptyActionHelperAfter: "สำหรับการเพิ่มคนช่วยแบบเร่งด่วน",
        displayNameRequired: "กรุณากรอกชื่อที่แสดง",
      },
    },
  },
};

function ClosedDayState({ dateLabel, closedAtLabel, isTodaySelected, copy }) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">
          ✓
        </div>

        <h2 className="mt-5 text-2xl font-semibold text-gray-900">
          {copy.storeClosedTitle}
        </h2>

        <p className="mt-2 text-sm text-gray-500">
          {copy.allRecordsFinalized}
        </p>

        {closedAtLabel ? (
          <p className="mt-3 text-sm font-medium text-green-700">
            Closed at {closedAtLabel}
          </p>
        ) : null}

        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-left text-sm text-gray-600">
          <p className="font-semibold text-gray-900">This day is locked.</p>

          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Bookings can no longer be edited from front desk.</li>
            <li>Payments and refunds are locked after closing.</li>
            <li>Historical records are available from Owner Reports.</li>
          </ul>
        </div>

        <p className="mt-5 text-xs text-gray-400">
          Use the date selector above to move to another day.
          {isTodaySelected ? " A new day can be started tomorrow." : ""}
        </p>
      </div>
    </div>
  );
}

function NotStartedDayState({ dateLabel, onStartDay, copy }) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">
          +
        </div>

        <h2 className="mt-5 text-2xl font-semibold text-gray-900">
          {copy.dayNotStarted}
        </h2>

        <p className="mt-2 text-sm text-gray-500">
          {copy.startBeforeBookings}
        </p>

        <p className="mt-3 text-sm font-medium text-amber-700">
          {dateLabel}
        </p>

        <button
          type="button"
          onClick={onStartDay}
          className="mt-6 rounded-2xl bg-[#4F6A55] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#435B49] hover:shadow-md"
        >
          {copy.startDay}
        </button>
      </div>
    </div>
  );
}

function SidebarButton({ title, icon: Icon, onClick, accent = false }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-sm transition ${
        accent
          ? "border-[#4F6A55] bg-[#4F6A55] text-white shadow-sm hover:bg-[#435B49]"
          : "border-[#E3D6C8] bg-white text-[#4F6A55] hover:border-[#BFCDBF] hover:bg-[#E8EFE8]"
      }`}
    >
      <Icon size={18} />
    </button>
  );
}

export default function StoreAdminPage() {
  const store = useStore();
  const storeFeatures = getStoreFeatures(store);
  const storeTimeZone = store.timezone || "Australia/Sydney";
  const todayInStoreTz = getTodayInTimeZone(storeTimeZone);
  const [locale, setLocaleState] = useState(() => {
    if (typeof window === "undefined") return "en";

    const savedLocale = window.localStorage.getItem(
      FRONT_DESK_LOCALE_STORAGE_KEY
    );

    if (savedLocale === "en" || savedLocale === "th") {
      return savedLocale;
    }

    return "en";
  });
  const frontDeskCopy = FRONT_DESK_COPY[locale] || FRONT_DESK_COPY.en;

  const [selectedDate, setSelectedDate] = useState(todayInStoreTz);

  const [trayData, setTrayData] = useState({
    bookings: [],
    activeBookings: [],
    inactiveBookings: [],
    unassignedBookings: [],
    missingAssignedPaidBookings: [],
  });

  const [storeDay, setStoreDay] = useState(null);
  const [endDaySummary, setEndDaySummary] = useState(null);
  const [loadingStoreDay, setLoadingStoreDay] = useState(true);

  const [showEndDayReport, setShowEndDayReport] = useState(false);
  const [endDayGuardMessage, setEndDayGuardMessage] = useState("");
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [showInactiveBookingsModal, setShowInactiveBookingsModal] =
    useState(false);
  const [showUnassignedBookingsModal, setShowUnassignedBookingsModal] =
    useState(false);
  const [showStaffControlsModal, setShowStaffControlsModal] = useState(false);
  const [showStartDayModal, setShowStartDayModal] = useState(false);

  const [gridRefreshToken, setGridRefreshToken] = useState(0);
  const [bookingToOpenFromUnassigned, setBookingToOpenFromUnassigned] =
    useState(null);

  const { user } = useAuthStore();
  const router = useRouter();

  function handleLocaleChange(nextLocale) {
    if (nextLocale !== "en" && nextLocale !== "th") return;

    setLocaleState(nextLocale);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        FRONT_DESK_LOCALE_STORAGE_KEY,
        nextLocale
      );
    }
  }

  useEffect(() => {
    if (!user || user.store_slug !== store.slug) {
      router.push(`/s/${store.slug}/login`);
    }
  }, [user, router, store.slug]);

  useEffect(() => {
    setSelectedDate((prev) => prev || getTodayInTimeZone(storeTimeZone));
  }, [storeTimeZone]);

  useEffect(() => {
    setEndDayGuardMessage("");
    setShowEndDayReport(false);
  }, [selectedDate]);

  async function loadEndDaySummary(dateToLoad) {
    if (!store?.slug || !dateToLoad) return null;

    try {
      const res = await fetch(
        storeApiUrl(
          store.slug,
          `/end-day-summary?date=${dateToLoad}&t=${Date.now()}`
        ),
        {
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load end day summary");
      }

      setEndDaySummary(data);
      return data;
    } catch (error) {
      console.error("Failed to load end day summary:", error);
      setEndDaySummary(null);
      return null;
    }
  }

  async function loadStoreDayForDate(dateToLoad) {
    if (!store?.slug || !dateToLoad) return null;

    setLoadingStoreDay(true);

    try {
      const res = await fetch(
        storeApiUrl(
          store.slug,
          `/store-day?date=${dateToLoad}&t=${Date.now()}`
        ),
        {
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load store day");
      }

      const nextStoreDay = data?.store_day || null;
      setStoreDay(nextStoreDay);

      await loadEndDaySummary(dateToLoad);

      return nextStoreDay;
    } catch (error) {
      console.error("Failed to load store day:", error);
      setStoreDay(null);
      setEndDaySummary(null);
      return null;
    } finally {
      setLoadingStoreDay(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function run() {
      if (!store?.slug || !selectedDate) return;

      setLoadingStoreDay(true);

      try {
        const res = await fetch(
          storeApiUrl(
            store.slug,
            `/store-day?date=${selectedDate}&t=${Date.now()}`
          ),
          {
            cache: "no-store",
          }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load store day");
        }

        if (isMounted) {
          setStoreDay(data?.store_day || null);
        }

        await loadEndDaySummary(selectedDate);
      } catch (error) {
        console.error("Failed to load store day:", error);

        if (isMounted) {
          setStoreDay(null);
          setEndDaySummary(null);
        }
      } finally {
        if (isMounted) {
          setLoadingStoreDay(false);
        }
      }
    }

    run();

    return () => {
      isMounted = false;
    };
  }, [store?.slug, selectedDate]);

  const dateLabel = useMemo(() => {
    const [year, month, day] = String(selectedDate).split("-").map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day));

    return utcDate.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: storeTimeZone,
    });
  }, [selectedDate, storeTimeZone]);

  const unassignedCount = trayData.unassignedBookings?.length || 0;

  const missingAssignedPaidCount =
    trayData.missingAssignedPaidBookings?.length || 0;

  const isTodaySelected = selectedDate === todayInStoreTz;

  const isStoreDayClosed =
    Boolean(storeDay?.closed_at);

  const isStoreDayStarted = Boolean(storeDay);

  const shouldBlockTodayOps =
    isTodaySelected &&
    !loadingStoreDay &&
    !storeDay &&
    !isStoreDayClosed;

  const canStartSelectedDay =
    !loadingStoreDay && !isStoreDayStarted && !isStoreDayClosed;

  const closedAtLabel = formatClosedAt(storeDay?.closed_at, storeTimeZone);

  function refreshGridNow() {
    setGridRefreshToken((prev) => prev + 1);
  }

  async function refreshDayData() {
    await loadStoreDayForDate(selectedDate);
    await loadEndDaySummary(selectedDate);
    refreshGridNow();
  }

  async function handleStartedDay(startedStoreDay) {
    const nextStoreDay =
      startedStoreDay?.store_day || startedStoreDay || null;

    if (nextStoreDay) {
      setStoreDay(nextStoreDay);
    }

    setShowStartDayModal(false);

    await refreshDayData();
  }

  async function handleStaffControlsUpdated() {
    await loadEndDaySummary(selectedDate);
    refreshGridNow();
  }

  async function handleWalkInCreated() {
    setShowWalkInModal(false);
    await loadEndDaySummary(selectedDate);
    refreshGridNow();
  }

  async function handleNewBookingCreated() {
    setShowNewBookingModal(false);
    await loadEndDaySummary(selectedDate);
    refreshGridNow();
  }

  function guardClosedDay(action) {
    if (isStoreDayClosed) return;
    action();
  }

  function handleOpenEndDay() {
    if (!isTodaySelected && !storeDay) {
      setShowEndDayReport(false);
      setEndDayGuardMessage(
        "This date was never opened. Start Day must be created before End Day can be finalized."
      );
      return;
    }

    setEndDayGuardMessage("");
    setShowEndDayReport(true);
  }

  return (
    <main className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#F6F1EA] p-3">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-[#E3D6C8] bg-[#FFFDF9] shadow-[0_18px_48px_rgba(47,41,38,0.12)]">
        <div className="sticky top-0 z-40 shrink-0 border-b border-[#E3D6C8] bg-[#FFFDF9]/95">
          <StoreInfoBar
            shopName={store.name}
            shopPhone={store.phone}
            shopAddress={store.address}
            ownerHref={`/s/${store.slug}/owner-login`}
            ownerLabel={frontDeskCopy.header.ownerDashboard}
            locale={locale}
            onLocaleChange={handleLocaleChange}
          />
        </div>

        <div className="sticky top-[73px] z-30 shrink-0 border-b border-[#E3D6C8] bg-[#FFFDF9]/95">
          <ScheduleToolbar
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            dateLabel={dateLabel}
            onOpenWalkIn={() =>
              guardClosedDay(() => setShowWalkInModal(true))
            }
            onOpenNewBooking={() =>
              guardClosedDay(() => setShowNewBookingModal(true))
            }
            copy={frontDeskCopy.toolbar}
          />
        </div>

        <div className="flex min-h-0 flex-1 bg-[#FFFDF9]">
          <aside className="flex w-16 shrink-0 flex-col items-center justify-between border-r border-[#E3D6C8] bg-[#F8F3EC] px-2 py-4">
            <div className="flex flex-col items-center gap-3">
              <SidebarButton
                title={frontDeskCopy.sidebar.newBooking}
                icon={CalendarPlus}
                accent
                onClick={() =>
                  guardClosedDay(() => setShowNewBookingModal(true))
                }
              />

              <SidebarButton
                title={frontDeskCopy.sidebar.addWalkIn}
                icon={ClipboardList}
                onClick={() =>
                  guardClosedDay(() => setShowWalkInModal(true))
                }
              />

              <SidebarButton
                title={frontDeskCopy.sidebar.staffControls}
                icon={SlidersHorizontal}
                onClick={() =>
                  guardClosedDay(() => setShowStaffControlsModal(true))
                }
              />
            </div>

            <SidebarButton
              title={frontDeskCopy.sidebar.ownerDashboard}
              icon={ShieldCheck}
              onClick={() => router.push(`/s/${store.slug}/owner-login`)}
            />
          </aside>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {isStoreDayClosed ? (
              <div className="shrink-0 border-b border-[#BFCDBF] bg-[#E8EFE8] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-[#3F5747]">
                    <span className="font-semibold">
                      {frontDeskCopy.states.storeClosed}
                    </span>
                    <span className="ml-2 text-[#4F6A55]">
                      {frontDeskCopy.states.recordsFinalized}
                    </span>
                  </div>

                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#4F6A55] ring-1 ring-[#BFCDBF]">
                    {frontDeskCopy.states.finalized}
                  </span>
                </div>
              </div>
            ) : null}

            {!isStoreDayClosed && endDayGuardMessage ? (
              <div className="shrink-0 border-b border-[#D6B894] bg-[#F1E4D5] px-4 py-3">
                <div className="text-sm text-[#6B4F35]">
                  <span className="font-semibold">
                    {frontDeskCopy.states.endDayUnavailable}
                  </span>
                  <span className="ml-2">{endDayGuardMessage}</span>
                </div>
              </div>
            ) : null}

            {!isStoreDayClosed && unassignedCount > 0 && (
              <div className="sticky top-[146px] z-20 shrink-0 border-b border-[#D6B894] bg-[#F1E4D5] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-[#6B4F35]">
                    <span className="font-semibold">
                      {unassignedCount}{" "}
                      {unassignedCount > 1
                        ? frontDeskCopy.alerts.bookingPlural
                        : frontDeskCopy.alerts.bookingSingular}{" "}
                      {frontDeskCopy.alerts.needsReassignment}
                    </span>
                    <span className="ml-2">
                      {frontDeskCopy.alerts.pendingWithoutStaff}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowUnassignedBookingsModal(true)}
                    className="rounded-xl border border-[#D6B894] bg-white/80 px-3 py-2 text-sm font-medium text-[#6B4F35] hover:bg-white"
                  >
                    {frontDeskCopy.alerts.reviewUnassigned}
                  </button>
                </div>
              </div>
            )}

            {!isStoreDayClosed && missingAssignedPaidCount > 0 && (
              <div className="sticky top-[146px] z-20 shrink-0 border-b border-[#BFCDBF] bg-[#E8EFE8] px-4 py-3">
                <div className="text-sm text-[#3F5747]">
                  <span className="font-semibold">
                    {missingAssignedPaidCount}{" "}
                    {missingAssignedPaidCount > 1
                      ? frontDeskCopy.alerts.paidBookingPlural
                      : frontDeskCopy.alerts.paidBookingSingular}{" "}
                    {frontDeskCopy.alerts.linkedToMissingStaff}
                  </span>
                  <span className="ml-2 text-[#4F6A55]">
                    {frontDeskCopy.alerts.checkOngoing}
                  </span>
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-hidden bg-white">
              {loadingStoreDay ? (
                <div className="flex h-full items-center justify-center bg-[#FFFDF9] text-sm text-[#7A675F]">
                  {frontDeskCopy.states.loadingDayStatus}
                </div>
              ) : isStoreDayClosed ? (
                <ClosedDayState
                  dateLabel={dateLabel}
                  closedAtLabel={closedAtLabel}
                  isTodaySelected={isTodaySelected}
                  copy={frontDeskCopy.states}
                />
              ) : canStartSelectedDay ? (
                <NotStartedDayState
                  dateLabel={dateLabel}
                  onStartDay={() => setShowStartDayModal(true)}
                  copy={frontDeskCopy.states}
                />
              ) : (
                <ScheduleGrid
                  selectedDate={selectedDate}
                  onDataChange={setTrayData}
                  refreshToken={gridRefreshToken}
                  externalSelectedBooking={bookingToOpenFromUnassigned}
                  onExternalBookingHandled={() =>
                    setBookingToOpenFromUnassigned(null)
                  }
                  storeSlug={store.slug}
                  bookingDetailsCopy={frontDeskCopy.modals.bookingDetails}
                />
              )}
            </div>

            {!isStoreDayClosed && !canStartSelectedDay && (
              <div className="shrink-0 border-t border-[#E3D6C8] bg-[#FFFDF9]">
                <BottomDayTray
                  selectedDate={selectedDate}
                  totalBookings={trayData.bookings?.length || 0}
                  activeCount={trayData.activeBookings?.length || 0}
                  cancelledCount={
                    trayData.inactiveBookings?.filter(
                      (booking) =>
                        booking.status?.toLowerCase() === "cancelled"
                    ).length || 0
                  }
                  noShowCount={
                    trayData.inactiveBookings?.filter(
                      (booking) => booking.status?.toLowerCase() === "no_show"
                    ).length || 0
                  }
                  unassignedCount={trayData.unassignedBookings?.length || 0}
                  onOpenInactive={() => setShowInactiveBookingsModal(true)}
                  onOpenUnassigned={() => setShowUnassignedBookingsModal(true)}
                  onOpenStaffControls={() => setShowStaffControlsModal(true)}
                  onOpenEndDay={handleOpenEndDay}
                  storeFeatures={storeFeatures}
                  storeDay={storeDay}
                  startTill={
                    endDaySummary?.startTill ??
                    endDaySummary?.stats?.startTill ??
                    storeDay?.start_till ??
                    0
                  }
                  cashOnTill={
                    endDaySummary?.cashOnTill ??
                    endDaySummary?.stats?.cashOnTill ??
                    storeDay?.start_till ??
                    0
                  }
                  copy={frontDeskCopy.tray}
                />
              </div>
            )}
          </section>
        </div>
      </div>

      <StartDayModal
        open={shouldBlockTodayOps || showStartDayModal}
        selectedDate={selectedDate}
        storeSlug={store.slug}
        storeName={store.name}
        storeFeatures={storeFeatures}
        existingStoreDay={storeDay}
        onStarted={handleStartedDay}
        copy={frontDeskCopy.modals.startDay}
      />

      <AddWalkInModal
        open={!isStoreDayClosed && showWalkInModal}
        selectedDate={selectedDate}
        onClose={() => setShowWalkInModal(false)}
        onCreated={handleWalkInCreated}
        storeSlug={store.slug}
        copy={frontDeskCopy.modals.addWalkIn}
      />

      <NewBookingModal
        open={!isStoreDayClosed && showNewBookingModal}
        selectedDate={selectedDate}
        onClose={() => setShowNewBookingModal(false)}
        onCreated={handleNewBookingCreated}
        storeSlug={store.slug}
        copy={frontDeskCopy.modals.newBooking}
      />

      <InactiveBookingsModal
        open={!isStoreDayClosed && showInactiveBookingsModal}
        bookings={trayData.inactiveBookings || []}
        onClose={() => setShowInactiveBookingsModal(false)}
        onRecover={async (booking) => {
          try {
            const res = await fetch(
              storeApiUrl(
                store.slug,
              ),
              {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  status: "pending",
                }),
              }
            );

            const data = await res.json();

            if (!res.ok) {
              throw new Error(
                data?.error || "Failed to recover booking"
              );
            }

            setShowInactiveBookingsModal(false);

            setTrayData((prev) => ({
              ...prev,
              inactiveBookings: (prev.inactiveBookings || []).filter(
                (item) => String(item.id) !== String(booking.id)
              ),
            }));

            await loadEndDaySummary(selectedDate);
            refreshGridNow();
          } catch (error) {
            console.error(error);
          }
        }}
      />

      <UnassignedBookingsModal
        open={!isStoreDayClosed && showUnassignedBookingsModal}
        bookings={trayData.unassignedBookings || []}
        onClose={() => setShowUnassignedBookingsModal(false)}
        onOpenBooking={(booking) => {
          setShowUnassignedBookingsModal(false);
          setBookingToOpenFromUnassigned(booking);
        }}
      />

      <StaffControlsModal
        open={!isStoreDayClosed && showStaffControlsModal}
        onClose={() => setShowStaffControlsModal(false)}
        selectedDate={selectedDate}
        storeSlug={store.slug}
        storeFeatures={storeFeatures}
        onUpdated={handleStaffControlsUpdated}
        copy={frontDeskCopy.modals.staffControls}
      />

      {showEndDayReport && !isStoreDayClosed && (
        <EndDayReport
          bookings={trayData.bookings || []}
          selectedDate={selectedDate}
          storeSlug={store.slug}
          storeFeatures={storeFeatures}
          copy={frontDeskCopy.modals.endDay}
          onClose={() => setShowEndDayReport(false)}
          onFinish={() => {
            setShowEndDayReport(false);
            refreshDayData();
          }}
        />
      )}
    </main>
  );
}
