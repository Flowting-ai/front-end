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

type TeamRole = "Owner" | "Admin" | "Member";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
}

const placeholderTeamMembers: TeamMember[] = [
  {
    id: "1",
    name: "Avnish Poonia",
    email: "avnish@getsouvenir.com",
    role: "Owner",
  },
  {
    id: "2",
    name: "Jane Doe",
    email: "jane.doe@getsouvenir.com",
    role: "Admin",
  },
  {
    id: "3",
    name: "John Smith",
    email: "john.smith@getsouvenir.com",
    role: "Member",
  },
  {
    id: "4",
    name: "Alex Patel",
    email: "alex.patel@getsouvenir.com",
    role: "Member",
  },
];

const getInitials = (fullName: string) => {
  const parts = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "TM";
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return initials || "TM";
};

export default function SettingsTeamsAndRolesPage() {
  const teamMembers = placeholderTeamMembers;
  const totalMembers = teamMembers.length;

  return (
    <AppLayout>
      <div className="w-full h-full flex justify-center items-start py-10 px-4 overflow-y-auto customScrollbar2">
        <div className="w-full max-w-4xl flex flex-col gap-6">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="font-clash text-2xl text-black">Team &amp; Roles</h1>
            <p className="font-geist text-sm text-black">
              Manage team members and their permissions.
            </p>
          </div>

          {/* Summary + Invite */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#757575]">
              {totalMembers} {totalMembers === 1 ? "member" : "members"}
            </p>
            <Button className="cursor-pointer font-geist font-medium text-sm text-[#FAFAFA] bg-[#171717] rounded-[8px] px-4 py-2 h-auto hover:bg-black">
              Invite Member
            </Button>
          </div>

          {/* Team members list */}
          <div className="flex flex-col gap-3">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-4 border-b border-[#E5E5E5] pb-3 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <div className="font-clash flex items-center justify-center w-11 h-11 rounded-full bg-black text-white text-sm font-medium">
                    {getInitials(member.name)}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-geist font-medium text-sm text-[#0A0A0A]">
                      {member.name}
                    </span>
                    <span className="text-sm text-[#0A0A0A]">
                      {member.email}
                    </span>
                  </div>
                </div>

                <Select defaultValue={member.role}>
                  <SelectTrigger className="min-w-[120px] border-[#D4D4D4] rounded-[8px] shadow-sm text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Owner">Owner</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Member">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}