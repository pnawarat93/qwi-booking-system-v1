import { create } from "zustand";
import {
  addMinutes,
  format,
  parse,
  isBefore,
  isAfter,
  isEqual,
} from "date-fns";
import { storeApiUrl } from "@/lib/storeApi";

function safeHourMinute(value, fallback) {
  if (!value) return fallback;
  return String(value).substring(0, 5);
}

const useBookingStore = create((set, get) => ({
  slug: "",
  store: null,
  businessHours: null,
  services: [],
  staff: [],
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

  setStore: (store) => set({ store }),

  setBusinessHours: (businessHours) => set({ businessHours }),

  setStaff: (staff) => set({ staff }),

  setSelectedStaff: (staff) =>
    set({
      selectedStaff: staff,
      selectedTime: null,
    }),

  setServices: (services) => set({ services }),

  setSelectedService: (service) =>
    set({
      selectedService: service,
      selectedTime: null,
    }),

  setSelectedPeople: (num) => set({ selectedPeople: num }),

  setSelectedDate: async (date) => {
    set({
      selectedDate: date,
      selectedTime: null,
      loading: true,
    });

    await Promise.all([
      get().fetchBookings(date),
      get().fetchBusinessHours(date),
    ]);

    set({ loading: false });
  },

  setSelectedTime: (time) => set({ selectedTime: time }),

  setAvailableStaffsForDate: (staff) =>
    set({ availableStaffsForDate: staff, staff }),

  toggleSelectedStaff: (staffMember) => {
    const { selectedStaffs, selectedPeople } = get();
    const exists = selectedStaffs.some((s) => s.id === staffMember.id);

    if (exists) {
      set({
        selectedStaffs: selectedStaffs.filter((s) => s.id !== staffMember.id),
      });
    } else if (selectedStaffs.length < (selectedPeople || 1)) {
      set({
        selectedStaffs: [...selectedStaffs, staffMember],
      });
    }
  },

  clearSelectedStaffs: () => set({ selectedStaffs: [] }),

  fetchServices: async () => {
    const { slug } = get();
    if (!slug) return;

    try {
      const response = await fetch(
        storeApiUrl(slug, "/services?status=active")
      );
      const data = await response.json();

      if (Array.isArray(data)) {
        set({ services: data });
      }
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  },

  fetchStaff: async () => {
    const { slug } = get();
    if (!slug) return;

    try {
      const response = await fetch(storeApiUrl(slug, "/staff"));
      const data = await response.json();

      if (Array.isArray(data)) {
        set({ staff: data });
      }
    } catch (error) {
      console.error("Error fetching staff:", error);
    }
  },

  fetchBookings: async (date) => {
    const { slug } = get();
    if (!slug || !date) return;

    try {
      const response = await fetch(
        storeApiUrl(slug, `/availability?date=${date}`)
      );
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

  fetchBusinessHours: async (date) => {
    const { slug } = get();
    if (!slug || !date) return;

    try {
      const response = await fetch(
        storeApiUrl(slug, `/business-hours?date=${date}`)
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load business hours");
      }

      set({ businessHours: data || null });
    } catch (error) {
      console.error("Error fetching business hours:", error);
      set({ businessHours: null });
    }
  },

  getAvailableSlots: () => {
    const {
      selectedService,
      selectedDate,
      bookings,
      staff,
      selectedStaff,
      selectedStaffs,
      selectedPeople,
      businessHours,
    } = get();

    if (!selectedService || !selectedDate || staff.length === 0) return [];

    if (!businessHours || businessHours.is_open === false) {
      return [];
    }

    const slots = [];
    const duration = Number(selectedService.duration || 0);
    const requiredStaffCount = selectedPeople || 1;

    const businessStart = safeHourMinute(businessHours?.open_time, "09:00");
    const businessEnd = safeHourMinute(businessHours?.close_time, "20:00");

    const startTime = parse(businessStart, "HH:mm", new Date());
    const endTime = parse(businessEnd, "HH:mm", new Date());

    let current = startTime;

    while (isBefore(current, endTime) || isEqual(current, endTime)) {
      const slotStartTimeStr = format(current, "HH:mm");
      const slotEndTime = addMinutes(current, duration);

      if (isAfter(slotEndTime, endTime)) {
        break;
      }

      let availableStaffIds = staff.map((s) => s.id);

      bookings.forEach((booking) => {
        if (!booking.time || !booking.staff_id) return;

        const bStart = parse(
          String(booking.time).substring(0, 5),
          "HH:mm",
          new Date()
        );

        const bDuration = Number(
          booking.service_duration_snapshot || booking.services?.duration || 60
        );

        const bEnd = addMinutes(bStart, bDuration);

        if (isBefore(current, bEnd) && isAfter(slotEndTime, bStart)) {
          availableStaffIds = availableStaffIds.filter(
            (id) => String(id) !== String(booking.staff_id)
          );
        }
      });

      let isAvailable = false;

      if (selectedStaffs && selectedStaffs.length > 0) {
        const allRequestedAvailable = selectedStaffs.every((selectedStaffRow) =>
          availableStaffIds.some((id) => String(id) === String(selectedStaffRow.id))
        );

        if (
          allRequestedAvailable &&
          availableStaffIds.length >= requiredStaffCount
        ) {
          isAvailable = true;
        }
      } else if (selectedStaff) {
        if (
          availableStaffIds.some(
            (id) => String(id) === String(selectedStaff.id)
          ) && availableStaffIds.length >= requiredStaffCount
        ) {
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
      selectedStaff: null,
      selectedStaffs: [],
      selectedPeople: null,
      selectedDate: "",
      selectedTime: null,
      bookings: [],
      businessHours: null,
    }),
}));

export default useBookingStore;