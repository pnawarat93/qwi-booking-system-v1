import { create } from "zustand";
import { addMinutes, format, parse, isBefore, isAfter, isEqual } from "date-fns";

const useBookingStore = create((set, get) => ({
  staffs: [],
  services: [],
  selectedService: null,
  selectedPeople: null,
  selectedDate: "",
  selectedTime: null,
  selectedStaff: null,
  bookings: [],
  loading: false,

  setServices: (services) => set({ services }),
  setStaffs: (staffs) => set({ staffs }),
  setSelectedStaff: (staff) => set({ selectedStaff: staff, selectedTime: null }), // Reset time when staff changes

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
    const { selectedService, selectedDate, bookings, staffs, selectedStaff, selectedPeople } = get();
    if (!selectedService || !selectedDate || staffs.length === 0) return [];

    const slots = [];
    const startTime = parse("09:00", "HH:mm", new Date());
    const endTime = parse("20:00", "HH:mm", new Date());
    const duration = selectedService.duration;

    let current = startTime;
    while (isBefore(current, endTime) || isEqual(current, endTime)) {
      const slotStartTimeStr = format(current, "HH:mm");
      const slotEndTime = addMinutes(current, duration);
      let availableStaffIds = staffs.map(s => s.id);
      if(selectedStaff) {
        availableStaffIds = [selectedStaff.id];
      }
      
      bookings.forEach(booking => {
        const bStart = parse(booking.time.substring(0, 5), "HH:mm", new Date());
        const bDuration = booking.services?.duration || 60; // Fallback or join data
        const bEnd = addMinutes(bStart, bDuration);

        // Overlap: StartA < EndB AND EndA > StartB
        if (isBefore(current, bEnd) && isAfter(slotEndTime, bStart)) {
          availableStaffIds = availableStaffIds.filter(id => id !== booking.staff_id);
        }
      });
      let isAvailable = false;
      if(selectedStaff) {
        if(availableStaffIds.includes(selectedStaff.id)) {
          if(selectedPeople >= selectedPeople) {
            isAvailable = true;
          }
        }
      } else {
        if(availableStaffIds.length >= selectedPeople) {
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
    selectedPeople: null,
    selectedDate: "",
    selectedTime: null,
    bookings: []
  })
}));

export default useBookingStore;