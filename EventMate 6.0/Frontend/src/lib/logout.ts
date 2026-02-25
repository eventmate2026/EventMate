import api from "./api";
import SummaryApi from "../api/SummaryApi";
import { clearAuth } from "./auth";

export const logoutUser = async () => {
  try {
    await api({ ...SummaryApi.logout });
  } catch {
    // Ignore logout errors and still clear local state.
  } finally {
    clearAuth();
  }
};
