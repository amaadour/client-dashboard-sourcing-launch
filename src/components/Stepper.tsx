"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface StepperProps {
  currentStep: number
  steps: string[]
  className?: string
}

export default function Stepper({ currentStep, steps, className }: StepperProps) {
  return (
    <div className={cn("w-full max-w-2xl mx-auto p-8", className)}>
      <div className="relative flex items-center justify-between">
        {/* Connecting Line Background */}
        <div className="absolute top-6 left-6 right-6 h-0.5 bg-gray-200 -z-10" />

        {/* Progress Line */}
        <div
          className="absolute top-6 left-6 h-0.5 bg-blue-600 -z-10 transition-all duration-300 ease-in-out"
          style={{
            width: currentStep > 1 ? `${((currentStep - 1) / (steps.length - 1)) * 100}%` : "0%",
            maxWidth: "calc(100% - 20px)",
          }}
        />

        {steps.map((step, index) => {
          const stepNumber = index + 1
          const isCompleted = stepNumber < currentStep
          const isCurrent = stepNumber === currentStep
          const isUpcoming = stepNumber > currentStep

          return (
            <div key={index} className="flex flex-col items-center relative">
              {/* Step Circle */}
              <div
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ease-in-out",
                  {
                    "bg-blue-600 text-white": isCurrent || isCompleted,
                    "bg-white border-2 border-gray-300 text-gray-500": isUpcoming,
                  },
                )}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : <span>{stepNumber}</span>}
              </div>

              {/* Step Label */}
              <div
                className={cn("mt-3 text-sm font-medium transition-colors duration-300", {
                  "text-blue-600": isCurrent,
                  "text-gray-500": isCompleted || isUpcoming,
                })}
              >
                {step}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
} 