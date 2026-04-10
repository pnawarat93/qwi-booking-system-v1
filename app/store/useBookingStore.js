import { create } from "zustand";
import { addMinutes, format, parse, isBefore, isAfter, isEqual } from "date-fns";

const useBookingStore = create((set, get) => ({
  staffs: [],
  availableStaffsForDate: [],
  services: [],
  selectedService: null,
  selectedPeople: null,
  selectedDate: "",
  selectedTime: null,
  selectedStaffs: [],
  bookings: [],
  loading: false,

  setServices: (services) => set({ services }),
  setStaffs: (staffs) => set({ staffs }),

  setAvailableStaffsForDate: (staffsForDate) =>
    set({
      availableStaffsForDate: staffsForDate,
      selectedTime: null,
    }),

  toggleSelectedStaff: (staff) => {
    const { selectedStaffs, selectedPeople } = get();
    const exists = selectedStaffs.some((s) => s.id === staff.id);

    if (exists) {
      set({
        selectedStaffs: selectedStaffs.filter((s) => s.id !== staff.id),
        selectedTime: null,
      });
      return true;
    }

    const maxSelectable = selectedPeople || 0;
    if (maxSelectable === 0 || selectedStaffs.length >= maxSelectable) {
      return false;
    }

    set({
      selectedStaffs: [...selectedStaffs, staff],
      selectedTime: null,
    });
    return true;
  },

  clearSelectedStaffs: () => set({ selectedStaffs: [], selectedTime: null }),

  setSelectedService: (service) =>
    set({
      selectedService: service,
      selectedTime: null,
    }),

  setSelectedPeople: (num) =>
    set({
      selectedPeople: num,
      selectedTime: null,
      selectedStaffs: [],
    }),

  setSelectedDate: async (date) => {
    set({
      selectedDate: date,
      selectedTime: null,
      loading: true,
      selectedPeople: null,
      selectedStaffs: [],
    });
    await get().fetchBookings(date);
    set({ loading: false });
  },

  setSelectedTime: (time) => set({ selectedTime: time }),

  fetchServices: async () => {
    try {
      const response = await fetch("/api/services");
      const data = await response.json();
      if (Array.isArray(data)) {
        set({ services: data });
      }
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  },

  fetchStaffs: async () => {
    try {
      const response = await fetch("/api/staffs");
      const data = await response.json();
      if (Array.isArray(data)) {
        set({ staffs: data });
      }
    } catch (error) {
      console.error("Error fetching staffs:", error);
    }
  },

  fetchBookings: async (date) => {
    try {
      const response = await fetch(`/api/booking?date=${date}`);
      const data = await response.json();

      if (Array.isArray(data)) {
        set({ bookings: data });
      } else {
        set({ bookings: [] });
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
      set({ bookings: [] });
    }
  },

  getAvailableSlots: () => {
    const {
      selectedService,
      selectedDate,
      bookings,
      selectedStaffs,
      selectedPeople,
      availableStaffsForDate,
    } = get();

    if (!selectedService || !selectedDate || availableStaffsForDate.length === 0) {
      return [];
    }

    const slots = [];
    const startTime = parse("09:00", "HH:mm", new Date());
    const endTime = parse("20:00", "HH:mm", new Date());
    const duration = Number(selectedService.duration || 60);

    let current = startTime;

    while (isBefore(current, endTime) || isEqual(current, endTime)) {
      const slotStartTimeStr = format(current, "HH:mm");
      const slotEndTime = addMinutes(current, duration);

      let availableStaffIds = availableStaffsForDate.map((s) => s.id);

      bookings.forEach((booking) => {
        const bookingStatus = String(booking.status || "").toLowerCase();
        if (!["pending", "paid"].includes(bookingStatus)) return;

        if (!booking.staff_id) return;

        const bookingTime = String(booking.time || "").substring(0, 5);
        if (!bookingTime) return;

        const bStart = parse(bookingTime, "HH:mm", new Date());
        const bDuration = Number(
          booking.services?.duration || booking.duration || 60
        );
        const bEnd = addMinutes(bStart, bDuration);

        const overlaps =
          isBefore(current, bEnd) && isAfter(slotEndTime, bStart);

        if (overlaps) {
          availableStaffIds = availableStaffIds.filter(
            (id) => String(id) !== String(booking.staff_id)
          );
        }
      });

      const requiredStaffCount = selectedPeople || 1;
      let isAvailable = false;

      if (selectedStaffs.length > 0) {
        const requiredStaffIds = selectedStaffs.map((s) => s.id);
        const hasRequiredStaff = requiredStaffIds.every((id) =>
          availableStaffIds.some((staffId) => String(staffId) === String(id))
        );

        if (hasRequiredStaff && availableStaffIds.length >= requiredStaffCount) {
          isAvailable = true;
        }
      } else {
        if (availableStaffIds.length >= requiredStaffCount) {
          isAvailable = true;
        }
      }

      if (isAvailable) {
        slots.push(slotStartTimeStr);
      }

      current = addMinutes(current, 5);
    }

    return slots;
  },

  resetBooking: () =>
    set({
      selectedService: null,
      selectedStaffs: [],
      selectedPeople: null,
      selectedDate: "",
      selectedTime: null,
      bookings: [],
      availableStaffsForDate: [],
    }),
}));

export default useBookingStore;