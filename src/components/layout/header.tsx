"use client";

import { Menu } from "lucide-react";

interface HeaderProps {
  user: {
    name: string;
    image?: string | null;
  };
  onMenuClick: () => void;
}

function UserAvatar({
  name,
  image,
}: {
  name: string;
  image?: string | null;
}) {
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className="h-8 w-8 rounded-full object-cover"
      />
    );
  }

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
      {initials}
    </div>
  );
}

export function Header({ user, onMenuClick }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-4 lg:hidden">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <span className="text-sm font-bold text-gray-900">Zimark ITSM</span>

      <UserAvatar name={user.name} image={user.image} />
    </header>
  );
}
