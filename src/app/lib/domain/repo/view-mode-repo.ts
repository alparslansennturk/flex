import type { ViewModeState } from "../core/view-mode";

export interface ViewModeRepo {
  get(uid: string): Promise<ViewModeState | null>;
  save(state: ViewModeState): Promise<void>;
}
