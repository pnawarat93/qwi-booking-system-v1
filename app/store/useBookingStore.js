import { create } from "zustand";
import { addMinutes, format, parse, isBefore, isAfter, isEqual } from "date-fns";

const useBookingStore = create((set, get) => ({
  services: [],
  selectedService: null,
  selectedPeople: null,
  selectedDate: "",
  selectedTime: null,
  bookings: [],
  loading: false,

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

  fetchBookings: async (date) => {
    try {
      const response = await fetch(`/api/availability?date=${date}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        set({ bookings: data });
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  },

  getAvailableSlots: () => {
    const { selectedService, selectedDate, bookings } = get();
    if (!selectedService || !selectedDate) return [];

    const slots = [];
    const startTime = parse("09:00", "HH:mm", new Date());
    const endTime = parse("20:00", "HH:mm", new Date());
    const duration = selectedService.duration;

    let current = startTime;
    while (isBefore(current, endTime) || isEqual(current, endTime)) {
      const slotStartTimeStr = format(current, "HH:mm");
      const slotEndTime = addMinutes(current, duration);
      
      const isAvailable = !bookings.some(booking => {
        // booking.time is "HH:mm:ss" usually from Postgres
        const bStart = parse(booking.time.substring(0, 5), "HH:mm", new Date());
        const bDuration = booking.services?.duration || 60; // Fallback or join data
        const bEnd = addMinutes(bStart, bDuration);

        // Overlap: StartA < EndB AND EndA > StartB
        return isBefore(current, bEnd) && isAfter(slotEndTime, bStart);
      });

      if (isAvailable) {
        slots.push(slotStartTimeStr);
      }

      current = addMinutes(current, 5);
    }

    return slots;
  },

  resetBooking: () => set({
    selectedService: null,
    selectedPeople: null,
    selectedDate: "",
    selectedTime: null,
    bookings: []
  })
}));

export default useBookingStore;