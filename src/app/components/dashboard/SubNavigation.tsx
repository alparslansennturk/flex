"use client";
import React from "react";

interface SubNavigationProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const SubNavigation: React.FC<SubNavigationProps> = ({ activeTab, onTabChange }) => {
  // Yönetim Paneli Menüsü Ayarları
  const tabs = [
    { id: "general", label: "Genel Ayarlar" },
    { id: "users", label: "Kullanıcı Yönetimi" },
    { id: "header-footer", label: "Header & Footer" },
    { id: "sidebar-management", label: "Sidebar Yönetimi" },
    { id: "logs", label: "Logs ve Yedekleme" },
  ];

  return (
    <div className="w-full mt-6">
      <div className="max-w-[1920px] mx-auto px-8">
        <div className="border-b border-surface-200 flex items-center justify-between h-20 px-4 md:px-5 lg:px-3 xl:px-4 2xl:px-14">
          <nav className="flex items-center h-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative h-full flex items-center px-8 first:pl-0 cursor-pointer outline-none group transition-colors"
              >
                <span
                  className={`text-[15px] font-semibold tracking-tight whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? "text-base-primary-500"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  {tab.label}
                </span>
                
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 w-full h-[3.2px] bg-base-primary-500 rounded-t-full animate-in fade-in slide-in-from-bottom-1 duration-300" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
};

export default SubNavigation;