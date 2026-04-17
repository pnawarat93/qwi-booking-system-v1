"use client";

import { useEffect, useMemo, useState } from "react";
import TypeBox from "@/app/components/TypeBox";
import useBookingStore from "@/store/useBookingStore";
import { useStore } from "../../StoreContext";
import { storeApiUrl } from "@/lib/storeApi";
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  X,
  Phone,
  CircleCheckBig,
  CalendarClock,
} from "lucide-react";

function getTodayInTimeZone(timeZone = "Australia/Sydney") {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

function formatDateInTimeZone(dateString, timeZone = "Australia/Sydney") {
  if (!dateString) return null;

  const [year, month, day] = String(dateString).split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(utcDate.getTime())) return dateString;

  return utcDate.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  });
}

function safeTimeLabel(value) {
  if (!value) return null;
  return String(value).substring(0, 5);
}

export default function BookingPage() {
  const store = useStore();
  const storeTimeZone = store.timezone || "Australia/Sydney";
  const todayInStoreTz = getTodayInTimeZone(storeTimeZone);

  const {
    services,
    selectedService,
    selectedPeople,
    selectedDate,
    selectedTime,
    selectedStaffs,
    bookings,
    loading,
    businessHours,
    fetchServices,
    setSelectedService,
    setSelectedPeople,
    setSelectedDate,
    setSelectedTime,
    toggleSelectedStaff,
    clearSelectedStaffs,
    getAvailableSlots,
    resetBooking,
    setAvailableStaffsForDate,
    setSlug,
    setStore,
  } = useBookingStore();

  const [availableStaffsForDate, setLocalAvailableStaffsForDate] = useState([]);

  const [currentStep, setCurrentStep] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState(null);

  const shopName = store.name;
  const shopPhone = store.phone || "";
  const shopAddress = store.address || "";

  const selectedDateIsClosed =
    selectedDate && businessHours && businessHours.is_open === false;

  const selectedDateHoursLabel =
    selectedDate && businessHours?.is_open
      ? `${safeTimeLabel(businessHours.open_time)} - ${safeTimeLabel(
        businessHours.close_time
      )}`
      : null;

  useEffect(() => {
    setSlug(store.slug);
    setStore(store);
  }, [store, setSlug, setStore]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    if (isSummaryOpen || isSuccessOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isSummaryOpen, isSuccessOpen]);

  useEffect(() => {
    async function fetchStaffShiftsForDate() {
      if (!selectedDate) {
        setLocalAvailableStaffsForDate([]);
        setAvailableStaffsForDate([]);
        return;
      }

      if (businessHours && businessHours.is_open === false) {
        setLocalAvailableStaffsForDate([]);
        setAvailableStaffsForDate([]);
        return;
      }

      try {
        const response = await fetch(
          storeApiUrl(store.slug, `/effective-staff?date=${selectedDate}`)
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Failed to load staff");
        }

        const normalized = Array.isArray(data?.items)
          ? data.items.map((staff) => ({
            id: staff.staff_id,
            name: staff.name_display || staff.name,
            staff_code: staff.staff_code || "",
          }))
          : [];

        setLocalAvailableStaffsForDate(normalized);
        setAvailableStaffsForDate(normalized);
      } catch (error) {
        console.error("Error loading staff shifts:", error);
        setLocalAvailableStaffsForDate([]);
        setAvailableStaffsForDate([]);
      }
    }

    fetchStaffShiftsForDate();
  }, [selectedDate, setAvailableStaffsForDate, store.slug, businessHours]);

  useEffect(() => {
    clearSelectedStaffs();
    setSelectedTime(null);
  }, [selectedDate, clearSelectedStaffs, setSelectedTime]);

  useEffect(() => {
    if (!selectedDate) return;

    const maxPeople = availableStaffsForDate.length;

    if (selectedPeople && selectedPeople > maxPeople) {
      setSelectedPeople(null);
    }

    const filteredSelectedStaffs = selectedStaffs.filter((selectedStaff) =>
      availableStaffsForDate.some(
        (staff) => String(staff.id) === String(selectedStaff.id)
      )
    );

    if (filteredSelectedStaffs.length !== selectedStaffs.length) {
      clearSelectedStaffs();
    }
  }, [
    selectedDate,
    availableStaffsForDate,
    selectedPeople,
    selectedStaffs,
    setSelectedPeople,
    clearSelectedStaffs,
  ]);

  const availableSlots = useMemo(
    () => getAvailableSlots(),
    [
      selectedService,
      selectedPeople,
      selectedStaffs,
      selectedDate,
      bookings,
      availableStaffsForDate,
      businessHours,
      getAvailableSlots,
    ]
  );

  const groupedSlots = useMemo(() => {
    const groups = {
      Morning: [],
      Afternoon: [],
      Evening: [],
    };

    availableSlots.forEach((time) => {
      const hour = parseInt(time.split(":")[0], 10);
      if (hour < 12) groups.Morning.push(time);
      else if (hour < 17) groups.Afternoon.push(time);
      else groups.Evening.push(time);
    });

    return groups;
  }, [availableSlots]);

  const peopleOptions = useMemo(() => {
    const count = availableStaffsForDate.length;
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [availableStaffsForDate]);

  const canProceed = () => {
    if (currentStep === 1) return !!selectedService;
    if (currentStep === 2) {
      return !!selectedDate && !selectedDateIsClosed;
    }
    if (currentStep === 3) return !!selectedPeople;
    if (currentStep === 4) return !!selectedTime;
    if (currentStep === 5) return customerName.trim() && customerPhone.trim();
    return false;
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  const nextStep = () => {
    if (currentStep < 6 && canProceed()) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const stepTitle = useMemo(() => {
    if (currentStep === 1) return "Select your service";
    if (currentStep === 2) return "Select date";
    if (currentStep === 3) return "Number of people";
    if (currentStep === 4) return "Staff preference and time";
    if (currentStep === 5) return "Customer information";
    return "Confirm booking";
  }, [currentStep]);

  const summaryLine = [
    selectedService?.name,
    selectedPeople
      ? `${selectedPeople} ${selectedPeople === 1 ? "person" : "people"}`
      : null,
    formatDateInTimeZone(selectedDate, storeTimeZone),
    selectedTime,
  ]
    .filter(Boolean)
    .join(" · ");

  const handleBooking = async () => {
    const bookingData = {
      customer_name: customerName,
      customer_phone: customerPhone,
      notes: customerNotes,
      service_id: selectedService.id,
      staff_ids: selectedStaffs.map((staff) => staff.id),
      is_walk_in: false,
      date: selectedDate,
      time: selectedTime,
      party_size: selectedPeople,
      status: "pending",
    };

    try {
      setIsSubmitting(true);

      const response = await fetch(storeApiUrl(store.slug, "/booking"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bookingData),
      });

      if (response.ok) {
        setIsSuccessOpen(true);
      } else {
        let errorMessage = "Booking failed";

        try {
          const errorData = await response.json();
          errorMessage = errorData?.error || errorMessage;
        } catch { }

        alert(`Booking failed: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Error submitting booking:", error);
      alert("An error occurred while booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeSuccessModal = () => {
    setIsSuccessOpen(false);
    resetBooking();
    setCurrentStep(1);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerNotes("");
    clearSelectedStaffs();
  };

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        <section id="shopdetail">
          <div className="rounded-[1.75rem] border border-[#E8D8CC] bg-white/65 px-4 py-7 text-center shadow-[0_10px_30px_rgba(180,140,120,0.10)] backdrop-blur-sm sm:rounded-4xl sm:px-6 sm:py-10">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-[#E5BCA9]/60 bg-[#FBEAD6]/80 px-3 py-1.5 text-xs text-[#6B7556] sm:text-sm">
              <Sparkles className="h-4 w-4 text-[#C87D87]" />
              Smooth booking experience powered by Qwi
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-[#4A3A34] sm:text-4xl md:text-5xl">
              {shopName}
            </h1>

            <p className="mt-2 text-sm text-[#7A675F] sm:text-base md:text-lg">
              {shopAddress || "Store address coming soon"}
            </p>
          </div>
        </section>

        <section id="booking">
          <div className="rounded-[1.75rem] border border-[#E8D8CC] bg-white/75 p-4 shadow-[0_12px_36px_rgba(180,140,120,0.10)] backdrop-blur-sm sm:rounded-4xl sm:p-6">
            <div className="text-center">
              <p className="mb-1 text-xs uppercase tracking-[0.24em] text-[#C87D87] sm:text-sm">
                Qwi Booking System
              </p>
              <h2 className="text-2xl font-semibold text-[#4A3A34] sm:text-3xl">
                Start booking your service
              </h2>
              <p className="mt-2 text-sm text-[#7A675F] sm:text-base">
                Step {currentStep} of 6 · {stepTitle}
              </p>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs text-[#8A7A72] sm:text-sm">
                <span>Progress</span>
                <span>{currentStep}/6</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-[#F3E8E1]">
                <div
                  className="h-full rounded-full bg-[#C87D87] transition-all duration-300"
                  style={{ width: `${(currentStep / 6) * 100}%` }}
                />
              </div>

              <div className="mt-4 flex justify-center gap-2">
                {[1, 2, 3, 4, 5, 6].map((step) => {
                  const isCurrent = step === currentStep;
                  const isDone = step < currentStep;

                  return (
                    <div
                      key={step}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold sm:h-10 sm:w-10 sm:text-sm ${isCurrent
                          ? "border-[#C87D87] bg-[#C87D87] text-white"
                          : isDone
                            ? "border-[#E5BCA9] bg-[#FBEAD6] text-[#6B7556]"
                            : "border-[#E8D8CC] bg-[#FFF9F6] text-[#A79790]"
                        }`}
                    >
                      {step}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-[#F0E2D8] bg-[#FFF9F6]/80 p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2 text-[#4A3A34]">
                <Sparkles className="h-5 w-5 text-[#C87D87]" />
                <p className="font-semibold">
                  Step {currentStep}: {stepTitle}
                </p>
              </div>

              {currentStep === 1 && (
                <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {services.map((service) => (
                    <div
                      key={service.id}
                      onClick={() => setSelectedService(service)}
                      className="cursor-pointer"
                    >
                      <TypeBox
                        type="service"
                        title={service.name}
                        servtime={`${service.duration} mins`}
                        price={service.price}
                        selected={selectedService?.id === service.id}
                      />
                    </div>
                  ))}
                </div>
              )}

              {currentStep === 2 && (
                <div className="flex flex-col items-center justify-center gap-4">
                  <input
                    type="date"
                    value={selectedDate}
                    min={todayInStoreTz}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full max-w-sm rounded-2xl border border-[#E5BCA9]/60 bg-white px-4 py-3 text-[#4A3A34] shadow-sm outline-none transition focus:border-[#C87D87] focus:ring-2 focus:ring-[#F0C4CB]/40"
                  />

                  {selectedDate && businessHours?.is_open && (
                    <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      <CalendarClock className="h-4 w-4" />
                      <span>
                        Open on {formatDateInTimeZone(selectedDate, storeTimeZone)}
                        {selectedDateHoursLabel ? ` · ${selectedDateHoursLabel}` : ""}
                      </span>
                    </div>
                  )}

                  {selectedDateIsClosed && (
                    <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                      <p className="font-semibold">Store is closed on this date.</p>
                      <p className="mt-1">
                        {businessHours?.note || "Please choose another date."}
                      </p>
                    </div>
                  )}

                  {loading && (
                    <p className="animate-pulse text-sm text-[#7A675F]">
                      Checking availability...
                    </p>
                  )}
                </div>
              )}

              {currentStep === 3 &&
                (!selectedDate ? (
                  <div className="py-8 text-center text-[#7A675F]">
                    <p>Please select a date first to see how many people can book.</p>
                  </div>
                ) : selectedDateIsClosed ? (
                  <div className="py-8 text-center text-[#7A675F]">
                    <p className="font-medium text-amber-900">Store is closed on this date.</p>
                    <p className="text-sm">
                      {businessHours?.note || "Please choose another date."}
                    </p>
                  </div>
                ) : loading ? (
                  <div className="py-8 text-center text-[#7A675F]">
                    <p className="animate-pulse">Loading staff for this date...</p>
                  </div>
                ) : peopleOptions.length === 0 ? (
                  <div className="py-8 text-center text-[#7A675F]">
                    <p>No staff available for this date.</p>
                    <p className="text-sm">Please choose another date.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                    {peopleOptions.map((num) => (
                      <div
                        key={num}
                        onClick={() => setSelectedPeople(num)}
                        className="cursor-pointer"
                      >
                        <TypeBox
                          type="numberppl"
                          pplnum={num}
                          selected={selectedPeople === num}
                        />
                      </div>
                    ))}
                  </div>
                ))}

              {currentStep === 4 && (
                <div className="space-y-6">
                  {selectedDateIsClosed ? (
                    <div className="py-10 text-center text-[#7A675F]">
                      <p className="font-medium text-amber-900">Store is closed on this date.</p>
                      <p className="text-sm">
                        {businessHours?.note || "Please choose another date."}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setIsStaffModalOpen(true)}
                          disabled={!selectedPeople || !selectedDate}
                          className={`text-xs underline underline-offset-4 transition ${selectedPeople && selectedDate
                              ? "text-[#7A675F] hover:text-[#4A3A34]"
                              : "cursor-not-allowed text-[#B7AAA3]"
                            }`}
                        >
                          Select Staff (optional)
                        </button>

                        {selectedStaffs.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {selectedStaffs.map((staff) => (
                              <span
                                key={staff.id}
                                className="rounded-full bg-[#FDF1F3] px-3 py-1 text-xs font-medium text-[#7A675F]"
                              >
                                {staff.name}
                              </span>
                            ))}
                          </div>
                        )}

                        {selectedDateHoursLabel && (
                          <p className="text-xs text-[#7A675F]">
                            Available within store hours: {selectedDateHoursLabel}
                          </p>
                        )}
                      </div>

                      {availableSlots.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          {Object.entries(groupedSlots).map(
                            ([range, slots]) =>
                              slots.length > 0 && (
                                <button
                                  key={range}
                                  onClick={() => {
                                    setSelectedTimeRange(range);
                                    setIsTimeModalOpen(true);
                                  }}
                                  className={`flex flex-col items-center justify-center rounded-2xl border-2 p-6 transition-all ${selectedTime &&
                                      groupedSlots[range].includes(selectedTime)
                                      ? "border-[#C87D87] bg-[#FFF9F6] shadow-sm"
                                      : "border-[#E8D8CC] bg-white hover:border-[#E5BCA9] hover:bg-[#FFF9F6]/50"
                                    }`}
                                >
                                  <span className="text-lg font-semibold text-[#4A3A34]">
                                    {range}
                                  </span>
                                  <span className="mt-1 text-xs text-[#7A675F]">
                                    {slots.length} slots available
                                  </span>
                                  {selectedTime &&
                                    groupedSlots[range].includes(selectedTime) && (
                                      <span className="mt-2 rounded-full bg-[#C87D87] px-3 py-1 text-xs font-medium text-white">
                                        Selected: {selectedTime}
                                      </span>
                                    )}
                                </button>
                              )
                          )}
                        </div>
                      ) : (
                        <div className="py-10 text-center text-[#7A675F]">
                          <p>No available slots for this service and date.</p>
                          <p className="text-sm">
                            Please try a different date or service.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {currentStep === 5 && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#7A675F]">
                      Name
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-2xl border border-[#E5BCA9]/60 bg-white px-4 py-3 text-[#4A3A34] shadow-sm outline-none transition focus:border-[#C87D87] focus:ring-2 focus:ring-[#F0C4CB]/40"
                      placeholder="Enter your name"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#7A675F]">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full rounded-2xl border border-[#E5BCA9]/60 bg-white px-4 py-3 text-[#4A3A34] shadow-sm outline-none transition focus:border-[#C87D87] focus:ring-2 focus:ring-[#F0C4CB]/40"
                      placeholder="Enter your phone number"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#7A675F]">
                      Notes / Requests (Optional)
                    </label>
                    <textarea
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      rows={4}
                      className="w-full rounded-2xl border border-[#E5BCA9]/60 bg-white px-4 py-3 text-[#4A3A34] shadow-sm outline-none transition focus:border-[#C87D87] focus:ring-2 focus:ring-[#F0C4CB]/40"
                      placeholder="e.g. female therapist, strong pressure, focus on neck and shoulders"
                    />
                  </div>
                </div>
              )}

              {currentStep === 6 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-[#4A3A34]">
                    Booking Summary
                  </h3>

                  <div className="rounded-3xl border border-[#E8D8CC] bg-white p-4 text-sm leading-7 text-[#5F4E47] shadow-sm sm:p-5">
                    <p>
                      <strong className="text-[#4A3A34]">Service:</strong>{" "}
                      {selectedService?.name}
                    </p>
                    <p>
                      <strong className="text-[#4A3A34]">Duration:</strong>{" "}
                      {selectedService?.duration} mins
                    </p>
                    <p>
                      <strong className="text-[#4A3A34]">Price:</strong> $
                      {selectedService?.price}
                    </p>
                    <p>
                      <strong className="text-[#4A3A34]">
                        Number of People:
                      </strong>{" "}
                      {selectedPeople}
                    </p>

                    {selectedStaffs.length > 0 && (
                      <p>
                        <strong className="text-[#4A3A34]">Requested Staff:</strong>{" "}
                        {selectedStaffs.map((staff) => staff.name).join(", ")}
                      </p>
                    )}

                    <p>
                      <strong className="text-[#4A3A34]">Date:</strong>{" "}
                      {formatDateInTimeZone(selectedDate, storeTimeZone)}
                    </p>
                    <p>
                      <strong className="text-[#4A3A34]">Time:</strong>{" "}
                      {selectedTime}
                    </p>
                    <p>
                      <strong className="text-[#4A3A34]">Name:</strong>{" "}
                      {customerName}
                    </p>
                    <p>
                      <strong className="text-[#4A3A34]">Phone:</strong>{" "}
                      {customerPhone}
                    </p>
                    {customerNotes && (
                      <p>
                        <strong className="text-[#4A3A34]">Notes:</strong>{" "}
                        {customerNotes}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={handleBooking}
                    disabled={isSubmitting}
                    className={`w-full rounded-2xl px-5 py-3.5 font-semibold text-white shadow-sm transition ${isSubmitting
                        ? "cursor-not-allowed bg-[#D9B3B8]"
                        : "bg-[#C87D87] hover:opacity-90"
                      }`}
                  >
                    {isSubmitting ? "Confirming..." : "Confirm Booking"}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={prevStep}
                disabled={currentStep === 1}
                className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold transition ${currentStep === 1
                    ? "cursor-not-allowed border border-[#E8D8CC] bg-[#F6F1ED] text-[#B7AAA3]"
                    : "border border-[#D9C5B8] bg-[#FFF9F6] text-[#6B7556] hover:bg-[#FBEAD6]/60"
                  }`}
              >
                <ArrowLeft size={18} />
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Back</span>
              </button>

              <button
                onClick={nextStep}
                disabled={currentStep === 6 || !canProceed()}
                className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold transition ${currentStep === 6 || !canProceed()
                    ? "cursor-not-allowed bg-[#EDE4DE] text-[#B7AAA3]"
                    : "bg-[#C87D87] text-white shadow-sm hover:opacity-90"
                  }`}
              >
                <span>{currentStep === 5 ? "Review" : "Next"}</span>
                <ArrowRight size={18} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsSummaryOpen(true)}
              className="mt-3 w-full rounded-2xl border border-[#E8D8CC] bg-white/70 px-4 py-3 text-sm font-medium text-[#7A675F] transition hover:bg-white"
            >
              {summaryLine ? "View booking summary" : "View current selections"}
            </button>
          </div>
        </section>
      </div>

      {isSummaryOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close summary"
            className="absolute inset-0 bg-[#2E211C]/35"
            onClick={() => setIsSummaryOpen(false)}
          />

          <div className="absolute bottom-0 left-0 right-0 rounded-t-4xl border-t border-[#E8D8CC] bg-[#FFF9F6] p-5 shadow-[0_-8px_30px_rgba(80,50,40,0.18)]">
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-[#D9C5B8]" />

            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-[#4A3A34]">
                  Your booking
                </p>
                <p className="text-sm text-[#7A675F]">
                  Review your selected details
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsSummaryOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E8D8CC] bg-white text-[#7A675F]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-[#F1E4DA] bg-white px-4 py-3">
                <p className="text-xs text-[#9A8A82]">Service</p>
                <p className="font-medium text-[#4A3A34]">
                  {selectedService?.name || "Not selected"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[#F1E4DA] bg-white px-4 py-3">
                  <p className="text-xs text-[#9A8A82]">Price</p>
                  <p className="font-medium text-[#4A3A34]">
                    {selectedService ? `$${selectedService.price}` : "-"}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#F1E4DA] bg-white px-4 py-3">
                  <p className="text-xs text-[#9A8A82]">Duration</p>
                  <p className="font-medium text-[#4A3A34]">
                    {selectedService?.duration
                      ? `${selectedService.duration} mins`
                      : "-"}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#F1E4DA] bg-white px-4 py-3">
                  <p className="text-xs text-[#9A8A82]">People</p>
                  <p className="font-medium text-[#4A3A34]">
                    {selectedPeople || "-"}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#F1E4DA] bg-white px-4 py-3">
                  <p className="text-xs text-[#9A8A82]">Time</p>
                  <p className="font-medium text-[#4A3A34]">
                    {selectedTime || "-"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#F1E4DA] bg-white px-4 py-3">
                <p className="text-xs text-[#9A8A82]">Date</p>
                <p className="font-medium text-[#4A3A34]">
                  {formatDateInTimeZone(selectedDate, storeTimeZone) || "-"}
                </p>
              </div>

              {selectedStaffs.length > 0 && (
                <div className="rounded-2xl border border-[#F1E4DA] bg-white px-4 py-3">
                  <p className="text-xs text-[#9A8A82]">Requested Staff</p>
                  <p className="font-medium text-[#4A3A34]">
                    {selectedStaffs.map((staff) => staff.name).join(", ")}
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsSummaryOpen(false)}
              className="mt-5 w-full rounded-2xl bg-[#C87D87] px-5 py-3.5 font-semibold text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isTimeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[#2E211C]/35"
            onClick={() => setIsTimeModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-2xl rounded-4xl border border-[#E8D8CC] bg-[#FFF9F6] p-6 shadow-[0_16px_50px_rgba(60,35,30,0.22)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-[#4A3A34]">
                  Select {selectedTimeRange} Time
                </h3>
                <p className="text-sm text-[#7A675F]">
                  5-minute intervals available
                </p>
              </div>
              <button
                onClick={() => setIsTimeModalOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E8D8CC] bg-white text-[#7A675F]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {groupedSlots[selectedTimeRange]?.map((time) => (
                  <button
                    key={time}
                    onClick={() => {
                      setSelectedTime(time);
                      setIsTimeModalOpen(false);
                    }}
                    className={`rounded-xl border py-3 text-sm font-medium transition ${selectedTime === time
                        ? "border-[#C87D87] bg-[#C87D87] text-white shadow-md"
                        : "border-[#E8D8CC] bg-white text-[#4A3A34] hover:border-[#E5BCA9] hover:bg-[#FFF9F6]"
                      }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setIsTimeModalOpen(false)}
                className="w-full rounded-2xl border border-[#D9C5B8] bg-white py-3 font-semibold text-[#4A3A34]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isSuccessOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#2E211C]/45" />

          <div className="relative z-10 w-full max-w-lg rounded-4xl border border-[#E8D8CC] bg-[#FFF9F6] p-6 shadow-[0_16px_50px_rgba(60,35,30,0.22)]">
            <div className="absolute left-0 right-0 top-0 h-1 rounded-t-4xl bg-[#6B7556]" />

            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF1E9]">
                  <CircleCheckBig className="h-6 w-6 text-[#6B7556]" />
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-[#6B7556]">
                    Booking confirmed
                  </h3>

                  <p className="text-sm text-[#7A675F]">
                    Your appointment has been secured successfully.
                  </p>
                </div>
              </div>

              <button
                onClick={closeSuccessModal}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E8D8CC] bg-white text-[#7A675F]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-sm text-[#5F4E47]">
              <div className="rounded-2xl border border-[#E8D8CC] bg-white px-4 py-3">
                Please arrive at least <strong>5 minutes before</strong> your appointment time.
              </div>

              <div className="rounded-2xl border border-[#E8D8CC] bg-white px-4 py-3">
                If you need to cancel or change your booking, please call the shop.
              </div>

              <div className="rounded-2xl border border-[#F0E2D8] bg-[#FBEAD6]/55 px-4 py-3">
                <p className="font-semibold text-[#4A3A34]">{shopName}</p>

                <div className="mt-1 flex items-center gap-2 text-[#6B7556]">
                  <Phone className="h-4 w-4" />
                  {shopPhone}
                </div>

                {shopAddress && (
                  <p className="mt-2 text-[#7A675F]">{shopAddress}</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={closeSuccessModal}
                className="flex-1 rounded-2xl bg-[#6B7556] px-5 py-3.5 font-semibold text-white transition hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[#2E211C]/35"
            onClick={() => setIsStaffModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-4xl border border-[#E8D8CC] bg-[#FFF9F6] p-6 shadow-[0_16px_50px_rgba(60,35,30,0.22)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-[#4A3A34]">
                  Pick Specific Staff
                </h3>
                <p className="text-sm text-[#7A675F]">
                  {selectedPeople
                    ? `You can select up to ${selectedPeople} staff members`
                    : "Select number of people first"}
                </p>
              </div>
              <button
                onClick={() => setIsStaffModalOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E8D8CC] bg-white text-[#7A675F]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  clearSelectedStaffs();
                  setIsStaffModalOpen(false);
                }}
                className={`w-full rounded-xl border py-3 text-sm font-medium transition ${selectedStaffs.length === 0
                    ? "border-[#C87D87] bg-[#C87D87] text-white shadow-md"
                    : "border-[#E8D8CC] bg-white text-[#4A3A34] hover:border-[#E5BCA9] hover:bg-[#FFF9F6]"
                  }`}
              >
                Any Available Staff
              </button>

              {availableStaffsForDate.map((staff) => (
                <button
                  key={staff.id}
                  onClick={() => {
                    toggleSelectedStaff(staff);
                  }}
                  disabled={!selectedPeople}
                  className={`w-full rounded-xl border py-3 text-sm font-medium transition ${selectedStaffs.some((s) => s.id === staff.id)
                      ? "border-[#C87D87] bg-[#C87D87] text-white shadow-md"
                      : "border-[#E8D8CC] bg-white text-[#4A3A34] hover:border-[#E5BCA9] hover:bg-[#FFF9F6]"
                    }`}
                >
                  {staff.name}
                </button>
              ))}

              <button
                onClick={() => setIsStaffModalOpen(false)}
                className="mt-3 w-full rounded-xl bg-[#C87D87] py-3 text-sm font-semibold text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}