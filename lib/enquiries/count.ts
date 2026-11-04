import "server-only";
import { enquiryStore } from "./store";

/** Unread enquiry count for the Studio nav badge (never throws). */
export async function newEnquiryCount(): Promise<number> {
  try {
    return await enquiryStore().countNew();
  } catch {
    return 0;
  }
}
