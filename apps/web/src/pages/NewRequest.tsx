import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { RequestForm } from "@/components/RequestForm";

export function NewRequest(): React.ReactElement {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-hemosync-navy transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-900 font-medium">New Request</span>
      </div>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          New Blood Request
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Fill in the details or use voice input to create an emergency broadcast.
        </p>
      </div>

      {/* Form card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <RequestForm />
      </div>
    </div>
  );
}
