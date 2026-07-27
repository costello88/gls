import { postGlsApi } from "./client";
import { GlsApiError } from "./errors";

interface ApiConfirmLabelResponse {
  error?: boolean;
  status?: string;
  message?: string;
  errors?: unknown;
  transactionId?: string;
}

export async function confirmGlsLabel(unitNo: string): Promise<void> {
  const requestBody = {
    username: process.env.GLS_USERNAME,
    password: process.env.GLS_PASSWORD,
    shippingSystemName: "gls-sync-web",
    shippingSystemVersion: "1.0",
    shiptype: "p",
    unitNo,
  };

  const response = await postGlsApi("/Label/Confirm", requestBody);
  const json = response.json as ApiConfirmLabelResponse | null;

  if (response.httpStatus !== 200) {
    throw new GlsApiError(
      json?.message ?? `GLS API returned HTTP ${response.httpStatus}`,
      response.httpStatus,
      json?.status,
      json?.errors,
    );
  }

  if (!json) {
    throw new GlsApiError(
      `GLS API returned a non-JSON response: ${response.text}`,
      response.httpStatus,
    );
  }

  if (json.error) {
    throw new GlsApiError(
      json.message ?? "GLS API reported an error confirming the label",
      response.httpStatus,
      json.status,
      json.errors,
    );
  }
}
