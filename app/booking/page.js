"use client";

import { useState } from "react";
import TypeBox from "../components/TypeBox";
import Header from "../components/Header";
import { Sparkles, ArrowLeft, ArrowRight } from "lucide-react";

export default function BookingPage() {
  const [currentStep, setCurrentStep] = useState(1);

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  return ( 
    <>
      <Header />
      <section id="shopdetail">
        <div className="w-full min-h-60 font-serif text-[#6b9161] flex justify-center items-center flex-col gap-3">
          <h1 className="text-5xl">Shop Name</h1>
          <h2 className="text-2xl">Shop Address</h2>
        </div>
      </section>

      <section id="booking">
        <div className="mx-auto w-[95%] flex flex-col gap-2 bg-white rounded-2xl p-4">
          <h2 className="text-center text-2xl font-semibold">Start booking your service</h2>
          
          {/* Step Indicator */}
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step === currentStep
                    ? "bg-[#6b9161] text-white"
                    : step < currentStep
                    ? "bg-green-100 text-[#6b9161]"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {step}
              </div>
            ))}
          </div>

          {/* Step Content */}
          {currentStep === 1 && (
            <div>
              <div className="flex flex-row">
                <Sparkles /> <p className="font-semibold">Step 1: Select your service</p>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <TypeBox type="service" title="Thai Massage" servtime="30mins" price="59" />
                <TypeBox type="service" title="Aroma Oil" servtime="30mins" price="59" />
                <TypeBox type="service" title="Foot Massage" servtime="30mins" price="59" />
                <TypeBox type="service" title="Deep Tissue" servtime="30mins" price="59" />
                <TypeBox type="service" title="Thai Massage" servtime="45mins" price="65" />
                <TypeBox type="service" title="Aroma Oil" servtime="45mins" price="69" />
                <TypeBox type="service" title="Foot Massage" servtime="45mins" price="65" />
                <TypeBox type="service" title="Deep Tissue" servtime="45mins" price="79" />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <div className="flex flex-row">
                <Sparkles /> <p className="font-semibold">Step 2: Number of people</p>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <TypeBox type="numberppl" pplnum={1} />
                <TypeBox type="numberppl" pplnum={2} />
                <TypeBox type="numberppl" pplnum={3} />
                <TypeBox type="numberppl" pplnum={4} />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <div className="flex flex-row">
                <Sparkles /> <p className="font-semibold">Step 3: Select preferred time</p>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <TypeBox type="time" time="Morning" />
                <TypeBox type="time" time="Afternoon" />
                <TypeBox type="time" time="Evening" />
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <div className="flex flex-row">
                <Sparkles /> <p className="font-semibold">Step 4: Select date</p>
              </div>
              <input type="date" className="p-3 rounded-2xl border shadow-sm w-full md:w-52.5 mx-auto" />
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-6">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${
                currentStep === 1
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-[#6b9161] text-white hover:bg-green-700"
              }`}
            >
              <ArrowLeft size={18} /> Previous
            </button>
            <button
              onClick={nextStep}
              disabled={currentStep === 4}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${
                currentStep === 4
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-[#6b9161] text-white hover:bg-green-700"
              }`}
            >
              Next <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}