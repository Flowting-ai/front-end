"use client";

import React, { useState, useMemo, useEffect } from "react";
import { X, Search } from "lucide-react";
import { workflowAPI } from "./workflow-api";

interface Persona {
  id: string;
  name: string;
  description?: string;
  image?: string;
}

interface AddPersonaDialogProps {
  allPersonas: Persona[];
  selectedPersonaId: string | undefined;
  onClose: () => void;
  onSelect: (personaId: string) => void;
}

export function AddPersonaDialog({
  allPersonas: propPersonas,
  selectedPersonaId,
  onClose,
  onSelect,
}: AddPersonaDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [personas, setPersonas] = useState<Persona[]>(propPersonas);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Always try to fetch fresh data when dialog opens
    const fetchPersonaData = async () => {
      setIsLoading(true);
      
      // Use provided personas if available
      if (propPersonas.length > 0) {
        console.log('Using provided personas:', propPersonas);
        setPersonas(propPersonas);
        setIsLoading(false);
        return;
      }

      // Check sessionStorage cache
      const cached = sessionStorage.getItem("allPersonas");
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Persona[];
          console.log('Using cached personas:', parsed);
          if (parsed.length > 0) {
            setPersonas(parsed);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.error('Failed to parse cached personas:', e);
        }
      }

      // Fetch from API
      try {
        console.log('Fetching personas from API...');
        const data = await workflowAPI.fetchPersonas();
        console.log('Fetched personas:', data);
        setPersonas(data);
        if (data.length > 0) {
          sessionStorage.setItem("allPersonas", JSON.stringify(data));
        }
      } catch (error) {
        console.error("Failed to fetch personas:", error);
        setPersonas([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPersonaData();
  }, [propPersonas]);

  const filteredPersonas = useMemo(() => {
    return personas.filter((persona) => {
      if (!persona || !persona.name) return false;
      return persona.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [personas, searchQuery]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSelectPersona = (personaId: string) => {
    onSelect(personaId);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[10px] border border-[#E5E5E5] shadow-lg flex flex-col gap-3 p-2"
        style={{
          width: "420px",
          height: "365px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-2">
          <h2 className="font-clash font-normal text-[24px] text-[#0A0A0A]">
            Select Persona
          </h2>
          <button
            onClick={onClose}
            className="cursor-pointer text-[#757575] hover:text-black transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative px-2">
          <Search className="absolute left-4 top-2.5 h-4 w-4 text-[#9F9F9F]" />
          <input
            type="text"
            placeholder="Search personas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-9 pr-3 py-1.5 rounded-lg border border-[#E5E5E5] font-geist font-normal text-sm text-[#0A0A0A] placeholder-[#737373] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>

        {/* Personas List */}
        <div className="flex-1 overflow-y-auto px-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-[#757575]">Loading personas...</div>
            </div>
          ) : filteredPersonas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#757575] text-sm gap-2">
              <div className="font-medium">No personas found</div>
              {searchQuery ? (
                <div className="text-xs">Try a different search term</div>
              ) : personas.length === 0 ? (
                <div className="text-xs text-center">
                  Create personas in the Personas page first
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredPersonas.map((persona) => (
                <button
                  key={persona.id}
                  onClick={() => handleSelectPersona(persona.id)}
                  className={`flex items-start gap-3 p-2 rounded-lg transition-colors duration-300 cursor-pointer ${
                    selectedPersonaId === persona.id
                      ? "bg-blue-50 border border-blue-300"
                      : "border border-[#E5E5E5] hover:bg-[#F5F5F5]"
                  }`}
                >
                  {/* Persona Image or Initials */}
                  <div className="flex-shrink-0 mt-0.5">
                    {persona.image && persona.image !== 'null' && persona.image.trim() !== '' ? (
                      <img
                        src={persona.image}
                        alt={persona.name}
                        className="w-10 h-10 rounded-lg object-cover"
                        onError={(e) => {
                          // Fallback to initials if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.className = 'w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-xs';
                            fallback.textContent = getInitials(persona.name);
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-xs">
                        {getInitials(persona.name)}
                      </div>
                    )}
                  </div>

                  {/* Persona Name and Description */}
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-black truncate">
                      {persona.name}
                    </p>
                    {persona.description && (
                      <p className="text-xs text-[#757575] line-clamp-2">
                        {persona.description}
                      </p>
                    )}
                  </div>

                  {/* Selection Indicator */}
                  {selectedPersonaId === persona.id && (
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center mt-0.5">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer - Cancel and Select Buttons */}
        <div className="flex items-center justify-end gap-2 px-2 py-1 border-t border-[#E5E5E5]">
          <button
            onClick={onClose}
            className="cursor-pointer h-8 rounded-lg px-4 bg-white border border-[#D4D4D4] text-sm font-medium text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedPersonaId) {
                onClose();
              }
            }}
            disabled={!selectedPersonaId}
            className="cursor-pointer h-8 rounded-lg px-4 bg-[#2C2C2C] text-white text-sm font-medium hover:bg-[#1F1F1F] transition-colors disabled:bg-[#D4D4D4] disabled:text-[#757575] disabled:cursor-not-allowed"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
