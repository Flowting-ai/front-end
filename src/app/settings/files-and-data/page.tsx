"use client";

import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SettingsFilesAndDataPage() {
  return (
    <AppLayout>
      <div className="w-full h-full flex justify-center items-start py-10 px-4 overflow-y-auto customScrollbar2">
        <div className="w-full max-w-4xl flex flex-col gap-6">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="font-clash text-2xl text-black">Files &amp; Data</h1>
            <p className="font-geist text-sm text-[#4B5563]">
              Manage uploaded files and storage.
            </p>
          </div>

          {/* Storage summary */}
          <div className="flex flex-col gap-2 border-b border-[#E5E5E5] pb-4">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <span className="font-geist font-medium text-sm text-[#0A0A0A]">
                  Storage used
                </span>
                <span className="font-geist font-medium text-[11px] text-white bg-[#14AE5C] rounded-full px-2 py-0.5">
                  Pro Plan
                </span>
              </div>
              <span className="ml-auto text-sm text-[#1E1E1E]">
                720MB / 2GB
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#D4D4D4] overflow-hidden">
              <div
                className="h-full bg-[#0A0A0A]"
                style={{ width: "36%" }}
              />
            </div>
          </div>

          {/* File processing */}
          <div className="flex flex-col gap-4 border-b border-[#E5E5E5] pb-5">
            <div className="space-y-1">
              <h2 className="font-clash text-xl text-black">File processing</h2>
              <p className="font-geist text-sm text-[#4B5563]">
                Configure how uploaded files are handled.
              </p>
            </div>

            <div className="flex flex-col gap-3 mt-3">
              {/* Max file size */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="font-geist font-medium text-sm text-[#0A0A0A]">
                    Max file size
                  </span>
                  <span className="text-sm text-[#0A0A0A]">
                    Per-file upload limit
                  </span>
                </div>
                <Select defaultValue="50mb">
                  <SelectTrigger className="min-w-[140px] rounded-[8px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50mb">50MB</SelectItem>
                    <SelectItem value="30mb">30MB</SelectItem>
                    <SelectItem value="10mb">10MB</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Allowed file types */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="font-geist font-medium text-sm text-[#0A0A0A]">
                    Allowed file types
                  </span>
                  <span className="text-sm text-[#0A0A0A]">
                    PDF, DOCX, TXT, CSV, XLSX, images
                  </span>
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="min-w-[180px] rounded-[8px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All file types</SelectItem>
                    <SelectItem value="docs">Documents only (PDF, DOCX, TXT)</SelectItem>
                    <SelectItem value="spreadsheets">Spreadsheets only (CSV, XLSX)</SelectItem>
                    <SelectItem value="images">Images only</SelectItem>
                    <SelectItem value="custom">Custom policy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Data management */}
          <div className="flex flex-col gap-4 mt-1">
            <div className="space-y-1">
              <h2 className="font-clash text-xl text-black">Data management</h2>
              <p className="font-geist text-sm text-[#4B5563]">
                Export or remove your stored files.
              </p>
            </div>

            <div className="flex flex-col gap-3 mt-1">
              {/* File retention */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="font-geist font-medium text-sm text-[#0A0A0A]">
                    File retention
                  </span>
                  <span className="text-sm text-[#0A0A0A]">
                    Auto-delete files after this period
                  </span>
                </div>
                <Select defaultValue="30">
                  <SelectTrigger className="min-w-[160px] rounded-[8px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 Days</SelectItem>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                    <SelectItem value="270">270 Days</SelectItem>
                    <SelectItem value="365">365 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Export all data */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="font-geist font-medium text-sm text-[#0A0A0A]">
                    Export all data
                  </span>
                  <span className="text-sm text-[#0A0A0A]">
                    Download chats, pins, personas, and files
                  </span>
                </div>
                <Button className="cursor-pointer font-geist font-medium text-sm text-[#FAFAFA] bg-[#171717] hover:bg-black rounded-[8px] px-3 py-2 h-auto">
                  Export
                </Button>
              </div>

              {/* Clear all files */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="font-geist font-medium text-sm text-[#0A0A0A]">
                    Clear all files
                  </span>
                  <span className="text-sm text-[#0A0A0A]">
                    Remove all uploaded files
                  </span>
                </div>
                <Button className="cursor-pointer font-geist font-medium text-sm text-[#FFFFFF] bg-[#DC2626] hover:bg-[#B91C1C] rounded-[8px] px-3 py-2 h-auto">
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}