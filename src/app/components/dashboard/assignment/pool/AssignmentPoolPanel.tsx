"use client";

import React, { useState } from "react";

import { POOL_LIST, type PoolKey, type PoolMeta } from "./poolTypes";
import CollagePoolPanel from "./CollagePoolPanel";
import BookPoolPanel from "./BookPoolPanel";
import SocialMediaPoolPanel from "./SocialMediaPoolPanel";

function PoolNavItem({
  pool,
  active,
  onClick,
}: {
  pool: PoolMeta;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = pool.icon;
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-all cursor-pointer ${
        active
          ? "bg-base-primary-900 text-white shadow-sm"
          : "hover:bg-surface-100 text-surface-700"
      }`}
    >
      <Icon size={18} className={`shrink-0 mt-0.5 ${active ? "text-white/80" : "text-surface-500"}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-bold leading-none mb-0.5 ${active ? "text-white" : "text-text-primary"}`}>
          {pool.label}
        </p>
        <p className={`text-[11px] truncate ${active ? "text-white/60" : "text-surface-400"}`}>
          {pool.description}
        </p>
      </div>
      {active && (
        <svg className="w-4 h-4 shrink-0 mt-0.5 text-white/60" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}

function renderPanel(key: PoolKey) {
  switch (key) {
    case "collage":     return <CollagePoolPanel />;
    case "book":        return <BookPoolPanel />;
    case "socialMedia": return <SocialMediaPoolPanel />;
  }
}

export default function AssignmentPoolPanel() {
  const [selected, setSelected] = useState<PoolKey>("collage");
  const current = POOL_LIST.find(p => p.key === selected)!;

  return (
    <div className="flex gap-6 min-h-[500px]">
      {/* Sol — ödev listesi */}
      <div className="w-64 shrink-0">
        <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wide px-1 mb-3">
          Ödev Havuzları
        </p>
        <div className="space-y-1">
          {POOL_LIST.map(pool => (
            <PoolNavItem
              key={pool.key}
              pool={pool}
              active={selected === pool.key}
              onClick={() => setSelected(pool.key)}
            />
          ))}
        </div>
      </div>

      {/* Sağ — seçilen ödevin havuzu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-5">
          {React.createElement(current.icon, { size: 22, className: "text-surface-500 shrink-0" })}
          <div>
            <h2 className="text-[18px] font-bold text-text-primary leading-none">{current.label}</h2>
            <p className="text-[12px] text-surface-400 mt-0.5">{current.description}</p>
          </div>
        </div>

        {renderPanel(selected)}
      </div>
    </div>
  );
}
