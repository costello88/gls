import { createGlsLabel } from "./createLabel";
import type { CreateLabelResult, LabelType, NormalizedShipment } from "./types";

// Deliberately does not call confirmGlsLabel: shipments must stay unconfirmed
// so they appear in GLS Print&Ship's "Bevestig zendingen" queue, which the
// user confirms manually (together with downloading the dagrapport) before
// handing packages to the courier.
export async function printGlsLabel(
  shipment: NormalizedShipment,
  labelType: LabelType,
  customerNo: string,
): Promise<CreateLabelResult> {
  return createGlsLabel(shipment, labelType, customerNo);
}
