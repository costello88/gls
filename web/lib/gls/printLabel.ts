import { createGlsLabel } from "./createLabel";
import { confirmGlsLabel } from "./confirmLabel";
import type { CreateLabelResult, LabelType, NormalizedShipment } from "./types";

export async function printGlsLabel(
  shipment: NormalizedShipment,
  labelType: LabelType,
  customerNo: string,
): Promise<CreateLabelResult> {
  const result = await createGlsLabel(shipment, labelType, customerNo);
  await confirmGlsLabel(result.unitNo);
  return result;
}
