import type { ViewPin } from "../core/view-pin";

export interface ViewPinRepo {
  get(uid: string): Promise<ViewPin | null>;
  save(pin: ViewPin): Promise<void>;
}
