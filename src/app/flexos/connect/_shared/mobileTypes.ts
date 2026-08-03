import type { ConversationView } from "./connectClient";

export type Screen = "app" | "chat" | "create" | "notif" | "help" | "password" | "starred" | "archive" | "legal" | "legal-kvkk";
export type Tab = "chats" | "channels" | "groups" | "communities" | "staff" | "settings";
export type ThemePref = "light" | "dark" | "system";
export interface ChannelSection { title: string; iconKey: string; tone: string; items: ConversationView[] }
