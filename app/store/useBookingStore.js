import { create } from "zustand";
import { addMinutes, format, parse, isBefore, isAfter, isEqual } from "date-fns";
import { storeApiUrl } from "@/lib/storeApi";

const useBookingStore = create((set, get) => ({
  slug: "",
  services: [],
  staffs: [],
  selectedService: null,
  selectedStaff: null,
  selectedStaffs: [],
  selectedPeople: null,
  selectedDate: "",
  selectedTime: null,
  bookings: [],
  loading: false,
  availableStaffsForDate: [],

  setSlug: (slug) => set({ slug }),

  setStaffs: (staffs) => set({ staffs }),

  setSelectedStaff: (staff) => set({
    selectedStaff: staff,
    selectedTime: null,
  }),

  setServices: (services) => set({ services }),

  setSelectedService: (service) => set({
    selectedService: service,
    selectedTime: null // Reset time when service changes as duration might differ
  }),

  setSelectedPeople: (num) => set({ selectedPeople: num }),

  setSelectedDate: async (date) => {
    set({ selectedDate: date, selectedTime: null, loading: true });
    await get().fetchBookings(date);
    set({ loading: false });
  },

  setSelectedTime: (time) => set({ selectedTime: time }),

  setAvailableStaffsForDate: (staffs) => set({ availableStaffsForDate: staffs, staffs: staffs }),

  toggleSelectedStaff: (staff) => {
    const { selectedStaffs, selectedPeople } = get();
    const exists = selectedStaffs.some((s) => s.id === staff.id);
    if (exists) {
      set({ selectedStaffs: selectedStaffs.filter((s) => s.id !== staff.id) });
    } else if (selectedStaffs.length < (selectedPeople || 1)) {
      set({ selectedStaffs: [...selectedStaffs, staff] });
    }
  },

  clearSelectedStaffs: () => set({ selectedStaffs: [] }),

  fetchServices: async () => {
    const { slug } = get();
    try {
      const response = await fetch(storeApiUrl(slug, "/services"));
      const data = await response.json();
      if (Array.isArray(data)) {
        set({ services: data });
      }
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  },

  fetchStaffs: async () => {
    const { slug } = get();
    try {
      const response = await fetch(storeApiUrl(slug, "/staffs"));
      const data = await response.json();
      if (Array.isArray(data)) {
        set({ staffs: data });
      }
    } catch (error) {
      console.error("Error fetching staffs:", error);
    }
  },

  fetchBookings: async (date) => {
    const { slug } = get();
    try {
      const response = await fetch(storeApiUrl(slug, `/availability?date=${date}`));
      const data = await response.json();
      if (Array.isArray(data)) {
        set({ bookings: data });
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  },

  getAvailableSlots: () => {
    const { selectedService, selectedDate, bookings, staffs, selectedStaff, selectedStaffs, selectedPeople } = get();
    // Return empty if no service/date selected, or if staffs haven't loaded yet
    if (!selectedService || !selectedDate || staffs.length === 0) return [];

    const slots = [];
    const startTime = parse("09:00", "HH:mm", new Date());
    const endTime = parse("20:00", "HH:mm", new Date());
    const duration = selectedService.duration;
    const requiredStaffCount = selectedPeople || 1;

    let current = startTime;
    while (isBefore(current, endTime) || isEqual(current, endTime)) {
      const slotStartTimeStr = format(current, "HH:mm");
      const slotEndTime = addMinutes(current, duration);

      let availableStaffIds = staffs.map(s => s.id);

      // Remove staff members who have an overlapping booking
      bookings.forEach(booking => {
        if (!booking.time || !booking.staff_id) return;

        const bStart = parse(booking.time.substring(0, 5), "HH:mm", new Date());
        const bDuration = booking.services?.duration || 60;
        const bEnd = addMinutes(bStart, bDuration);

        // Overlap: StartA < EndB AND EndA > StartB
        if (isBefore(current, bEnd) && isAfter(slotEndTime, bStart)) {
          // This staff member is busy
          availableStaffIds = availableStaffIds.filter(id => id !== booking.staff_id);
        }
      });

      let isAvailable = false;

      if (selectedStaffs && selectedStaffs.length > 0) {
        // If specific staffs are requested, they MUST all be available
        const allRequestedAvailable = selectedStaffs.every((s) =>
          availableStaffIds.includes(s.id)
        );
        if (allRequestedAvailable && availableStaffIds.length >= requiredStaffCount) {
          isAvailable = true;
        }
      } else if (selectedStaff) {
        // If a single specific staff is requested
        if (availableStaffIds.includes(selectedStaff.id)) {
          if (availableStaffIds.length >= requiredStaffCount) {
            isAvailable = true;
          }
        }
      } else {
        // No specific staff requested, just need enough total staff
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

  resetBooking: () => set({
    selectedService: null,
    selectedStaff: null,
    selectedStaffs: [],
    selectedPeople: null,
    selectedDate: "",
    selectedTime: null,
    bookings: []
  })
}));

export default useBookingStore;