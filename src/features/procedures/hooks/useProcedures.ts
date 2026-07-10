import { invoke } from "@tauri-apps/api/core";
import type {
  Procedure,
  ProcedureSummary,
  PriceHistoryEntry,
  CreateProcedureRequest,
  UpdateProcedureRequest,
  UpdatePriceRequest,
} from "../types";

export function useProcedures() {
  const listProcedures = async (
    activeOnly: boolean = true,
    category?: string | null,
  ): Promise<ProcedureSummary[]> => {
    return invoke<ProcedureSummary[]>("list_procedures", {
      activeOnly,
      category: category || null,
    });
  };

  const searchProcedures = async (query: string): Promise<ProcedureSummary[]> => {
    return invoke<ProcedureSummary[]>("search_procedures", { query });
  };

  const getProcedure = async (id: number): Promise<Procedure> => {
    return invoke<Procedure>("get_procedure", { id });
  };

  const createProcedure = async (request: CreateProcedureRequest): Promise<Procedure> => {
    return invoke<Procedure>("create_procedure", { request });
  };

  const updateProcedure = async (request: UpdateProcedureRequest): Promise<Procedure> => {
    return invoke<Procedure>("update_procedure", { request });
  };

  const updatePrice = async (request: UpdatePriceRequest): Promise<Procedure> => {
    return invoke<Procedure>("update_procedure_price", { request });
  };

  const getPriceHistory = async (procedureId: number): Promise<PriceHistoryEntry[]> => {
    return invoke<PriceHistoryEntry[]>("get_procedure_price_history", { procedureId });
  };

  const deactivateProcedure = async (id: number): Promise<void> => {
    return invoke<void>("deactivate_procedure", { id });
  };

  return {
    listProcedures,
    searchProcedures,
    getProcedure,
    createProcedure,
    updateProcedure,
    updatePrice,
    getPriceHistory,
    deactivateProcedure,
  };
}
