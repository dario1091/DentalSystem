import { invoke } from "@tauri-apps/api/core";
import type {
  Prize, PatientPrize,
  CreatePrizeRequest, UpdatePrizeRequest, SpinRequest, RedeemPrizeRequest,
} from "../types";

export function useRewards() {
  const listPrizes = async (onlyActive: boolean): Promise<Prize[]> => {
    return invoke<Prize[]>("list_prizes", { onlyActive });
  };

  const createPrize = async (request: CreatePrizeRequest): Promise<Prize> => {
    return invoke<Prize>("create_prize", { request });
  };

  const updatePrize = async (request: UpdatePrizeRequest): Promise<Prize> => {
    return invoke<Prize>("update_prize", { request });
  };

  const deletePrize = async (id: number): Promise<void> => {
    return invoke<void>("delete_prize", { id });
  };

  const spinWheel = async (request: SpinRequest): Promise<PatientPrize> => {
    return invoke<PatientPrize>("spin_wheel", { request });
  };

  const listPatientPrizes = async (patientId: number): Promise<PatientPrize[]> => {
    return invoke<PatientPrize[]>("list_patient_prizes", { patientId });
  };

  const listPendingPrizes = async (): Promise<PatientPrize[]> => {
    return invoke<PatientPrize[]>("list_pending_prizes", {});
  };

  const redeemPrize = async (request: RedeemPrizeRequest): Promise<PatientPrize> => {
    return invoke<PatientPrize>("redeem_prize", { request });
  };

  return {
    listPrizes,
    createPrize,
    updatePrize,
    deletePrize,
    spinWheel,
    listPatientPrizes,
    listPendingPrizes,
    redeemPrize,
  };
}
