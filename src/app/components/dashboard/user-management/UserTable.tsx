"use client";
import React, { useState } from "react";
import { PenLine, Trash2 } from "lucide-react";
import { auth } from "@/app/lib/firebase";

interface UserData {
  id: string;
  uid?: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  branch: string;
  branches?: string[];
  gender: 'male' | 'female' | '';
  title: string;
  avatarId: number;
  roles: string[];
  permissionOverrides: Record<string, boolean>;
  isActivated: boolean;
}
interface UserTableProps {
  users: UserData[];
  branches?: { id: string; name: string }[];
  onEdit: (user: UserData) => void;
  onDelete: (id: string) => void;
}

function HoverPopover({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <div onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
        {trigger}
      </div>
      {open && (
        <div
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-white border border-neutral-200 rounded-xl shadow-lg p-2 flex flex-col gap-1"
        >
          {children}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-b border-r border-neutral-200 rotate-45 -mt-1" />
        </div>
      )}
    </div>
  );
}

function BranchCell({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-[11px] text-neutral-300 font-medium">—</span>;

  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
        {names[0]}
      </span>
      {names.length > 1 && (
        <HoverPopover
          trigger={
            <button className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-neutral-100 text-neutral-500 border border-neutral-200 cursor-default hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-colors">
              +{names.length - 1}
            </button>
          }
        >
          {names.map((name) => (
            <span key={name} className="px-2 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap">
              {name}
            </span>
          ))}
        </HoverPopover>
      )}
    </div>
  );
}

function RoleCell({ roles }: { roles: string[] }) {
  if (!roles?.length) return <span className="text-[11px] text-neutral-300 font-medium">—</span>;

  const label = (role: string) => role === 'admin' ? 'Admin' : 'Eğitmen';
  const cls = (role: string) => role === 'admin'
    ? 'bg-orange-50 text-orange-600 border-orange-100'
    : 'bg-blue-50 text-blue-600 border-blue-100';

  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold border shadow-sm ${cls(roles[0])}`}>
        {label(roles[0])}
      </span>
      {roles.length > 1 && (
        <HoverPopover
          trigger={
            <button className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-neutral-100 text-neutral-500 border border-neutral-200 cursor-default hover:bg-neutral-200 transition-colors">
              +{roles.length - 1}
            </button>
          }
        >
          {roles.map((role) => (
            <span key={role} className={`px-2 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap ${cls(role)}`}>
              {label(role)}
            </span>
          ))}
        </HoverPopover>
      )}
    </div>
  );
}

export const UserTable = ({ users, branches = [], onEdit, onDelete }: UserTableProps) => {
  const getBranchNames = (branchIds: string[]) =>
    (branchIds || []).map((id: string) => branches.find(b => b.id === id)?.name).filter(Boolean) as string[];

  return (
    <div className="bg-white rounded-[24px] border border-neutral-100 overflow-hidden shadow-sm mt-6">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-neutral-100 bg-neutral-50/50">
            <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500">Kullanıcı</th>
            <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 text-left whitespace-nowrap">Roller</th>
            <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 text-left whitespace-nowrap">Branşlar</th>
            <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 text-left">E-Posta</th>
            <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 text-left whitespace-nowrap">Telefon</th>
            <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 text-left whitespace-nowrap">Şube</th>
            <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 text-center whitespace-nowrap">Durum</th>
            <th className="p-3 xl:p-5 text-[12px] xl:text-[13px] font-bold text-neutral-500 text-center whitespace-nowrap sticky right-0 bg-neutral-50/80 backdrop-blur-sm">İşlem</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-50">
          {users.map((user: UserData) => {
            const isMe = user.email === auth.currentUser?.email;
            const branchNames = getBranchNames(user.branches || []);

            return (
              <tr key={user.id} className={`hover:bg-neutral-50/50 transition-colors group ${!user.isActivated ? 'bg-amber-50/30' : ''}`}>

                <td className="p-3 xl:p-5">
                  <div className="flex items-center gap-2 xl:gap-3 min-w-0">
                    <div className="w-6 h-6 xl:w-8 xl:h-8 rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0 shadow-sm">
                      <img
                        src={`/avatars/${user.gender === 'female' ? 'female' : 'male'}/${user.avatarId || 1}.svg`}
                        className="w-full h-full object-cover"
                        alt=""
                        onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/male/1.svg'; }}
                      />
                    </div>
                    <HoverPopover
                      trigger={
                        <div className="font-bold text-[#10294C] text-[13px] xl:text-[14px] min-w-0 truncate cursor-default">
                          {user.name} {user.surname} {isMe && <span className="ml-1 text-[10px] text-blue-500 font-normal">(Siz)</span>}
                        </div>
                      }
                    >
                      <span className="px-2 py-1 text-[11px] font-bold text-[#10294C] whitespace-nowrap">{user.name} {user.surname}</span>
                    </HoverPopover>
                  </div>
                </td>

                <td className="p-3 xl:p-5 text-left">
                  <RoleCell roles={user.roles} />
                </td>

                <td className="p-3 xl:p-5 text-left">
                  <BranchCell names={branchNames} />
                </td>

                <td className="p-3 xl:p-5 text-[12px] xl:text-[13px] text-neutral-400 text-left">
                  <HoverPopover
                    trigger={
                      <span className="block truncate max-w-[160px] xl:max-w-none cursor-default">{user.email}</span>
                    }
                  >
                    <span className="px-2 py-1 text-[11px] font-medium text-neutral-600 whitespace-nowrap">{user.email}</span>
                  </HoverPopover>
                </td>

                <td className="p-3 xl:p-5 text-[11px] xl:text-[13px] font-bold text-[#10294C] text-left whitespace-nowrap">{user.phone || "—"}</td>

                <td className="p-3 xl:p-5 text-left">
                  <HoverPopover
                    trigger={
                      <span className="text-[11px] xl:text-[12px] font-semibold text-[#10294C] bg-neutral-100 px-2 py-0.5 rounded-lg border border-neutral-200 inline-block max-w-[80px] xl:max-w-none truncate cursor-default">
                        {user.branch || "—"}
                      </span>
                    }
                  >
                    <span className="px-2 py-1 text-[11px] font-semibold text-[#10294C] whitespace-nowrap">{user.branch || "—"}</span>
                  </HoverPopover>
                </td>

                <td className="p-3 xl:p-5 text-center whitespace-nowrap">
                  <div className="inline-flex items-center gap-2 justify-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] xl:text-[11px] font-bold shrink-0 ${user.isActivated ? 'bg-green-50 text-green-600' : 'bg-amber-100 text-amber-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1 ${user.isActivated ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                      {user.isActivated ? 'Aktif' : 'Beklemede'}
                    </span>
                    <button
                      type="button"
                      disabled={isMe}
                      onClick={() => {
                        const action = user.isActivated ? "PASİFE" : "AKTİFE";
                        if (window.confirm(`${user.name} ${user.surname} kullanıcısını ${action} almak istediğinize emin misiniz?`)) {
                          onEdit({ ...user, isActivated: !user.isActivated });
                        }
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isMe ? 'opacity-30 cursor-not-allowed bg-neutral-200' : (user.isActivated ? 'bg-green-500 cursor-pointer' : 'bg-neutral-300 cursor-pointer')}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${user.isActivated ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </td>

                <td className="p-3 xl:p-5 text-center sticky right-0 bg-white group-hover:bg-neutral-50/50 transition-colors">
                  <div className="flex justify-center gap-1 xl:gap-2">
                    <button onClick={() => onEdit(user)} className="p-1 xl:p-1.5 text-neutral-400 hover:text-orange-500 transition-colors cursor-pointer">
                      <PenLine size={15} />
                    </button>
                    <button
                      disabled={isMe}
                      onClick={() => onDelete(user.id)}
                      className={`p-1 xl:p-1.5 transition-colors ${isMe ? "text-neutral-200 cursor-not-allowed opacity-50" : "text-neutral-400 hover:text-red-500 cursor-pointer"}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
