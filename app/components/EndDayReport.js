"use client";

import { useState, useMemo } from "react";
import { Moon, CheckCircle, TrendingUp, AlertCircle, X, Download, Landmark, CreditCard, Banknote } from "lucide-react";

export default function EndDayReport({ bookings, onClose, onFinish }) {
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalJobs = bookings.length;
    let completedJobs = 0;
    let outstanding = 0;
    let byMethod = {
      Cash: 0,
      Eftpos: 0,
      Transfer: 0,
      Split: 0,
    };

    bookings.forEach(b => {
      const price = parseFloat(b.services?.price || 0);
      if (b.job_status === 'completed' || b.status === 'completed') {
        completedJobs += 1;
      }
      
      if (b.payment_status === 'Paid') {
        totalRevenue += price;
        // In a real app, we'd sum the actual payment records. 
        // For this UI, we'll assume the primary method if not available or just sum the price.
        byMethod["Cash"] += price; // Mock attribution
      } else {
        outstanding += price;
      }
    });

    return { totalRevenue, totalJobs, completedJobs, outstanding, byMethod };
  }, [bookings]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-xl overflow-hidden rounded-[3rem] bg-white shadow-2xl animate-in zoom-in duration-300">
        
        {/* Header */}
        <div className="bg-[#4A3A34] p-8 text-white relative">
          <button onClick={onClose} className="absolute right-8 top-8 text-white/40 hover:text-white transition">
            <X size={24} />
          </button>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C87D87] mb-4">
            <Moon size={24} />
          </div>
          <h2 className="text-3xl font-bold">End of Day Report</h2>
          <p className="mt-1 text-white/60">Summary of performance for today</p>
        </div>

        <div className="p-8 space-y-8">
          
          {/* Main KPI Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#FFF9F6] p-6 rounded-[2rem] border border-[#F1E4DA]">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-emerald-500" />
                <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">Jobs Done</span>
              </div>
              <p className="text-3xl font-black text-[#4A3A34]">{stats.completedJobs} / {stats.totalJobs}</p>
            </div>
            
            <div className="bg-[#FFF9F6] p-6 rounded-[2rem] border border-[#F1E4DA]">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-[#C87D87]" />
                <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">Net Revenue</span>
              </div>
              <p className="text-3xl font-black text-[#4A3A34]">${stats.totalRevenue.toFixed(2)}</p>
            </div>
          </div>

          {/* Payment Breakdown */}
          <div>
            <h3 className="mb-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Payment Breakdown</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 italic text-sm text-gray-400">
                Detailed method breakdown requires payment sync...
              </div>
              
              <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="h-8 w-8 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-sm">
                     <AlertCircle size={18} />
                   </div>
                   <span className="font-bold text-amber-700">Outstanding (Unpaid)</span>
                </div>
                <span className="text-lg font-black text-amber-900">${stats.outstanding.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-4 pt-4 border-t border-gray-100">
            <button 
              onClick={onClose}
              className="flex-1 rounded-2xl py-4 font-bold text-gray-400 hover:bg-gray-50 transition border border-gray-100"
            >
              Back to Grid
            </button>
            <button 
              onClick={onFinish}
              className="flex-[1.5] rounded-2xl bg-[#C87D87] py-4 font-bold text-white shadow-lg hover:bg-[#B8707A] transition"
            >
              Complete End of Day
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}