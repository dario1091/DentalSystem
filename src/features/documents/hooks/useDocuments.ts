import { invoke } from "@tauri-apps/api/core";
import type { Document, UploadDocumentRequest, ListDocumentsRequest } from "../types";

export function useDocuments() {
  const uploadDocument = async (request: UploadDocumentRequest): Promise<Document> => {
    return invoke<Document>("upload_document", { request });
  };

  const listDocuments = async (request: ListDocumentsRequest): Promise<Document[]> => {
    return invoke<Document[]>("list_documents", { request });
  };

  const getDocumentData = async (id: number): Promise<number[]> => {
    return invoke<number[]>("get_document_data", { id });
  };

  const deleteDocument = async (id: number): Promise<void> => {
    return invoke<void>("delete_document", { id });
  };

  const setDocumentsPath = async (path: string): Promise<void> => {
    return invoke<void>("set_documents_path", { path });
  };

  const getDocumentsPath = async (): Promise<string> => {
    return invoke<string>("get_documents_path");
  };

  const getDiskSpace = async (): Promise<number> => {
    return invoke<number>("get_disk_space");
  };

  return {
    uploadDocument,
    listDocuments,
    getDocumentData,
    deleteDocument,
    setDocumentsPath,
    getDocumentsPath,
    getDiskSpace,
  };
}
