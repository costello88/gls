export interface GlsImportRow {
  name: string;
  street: string;
  houseNo: string;
  zipCode: string;
  city: string;
  countryCode: string;
  phone: string;
  email: string;
  orderNumber: string;
  senderNumber: string;
}

const CSV_HEADERS = [
  "Name",
  "Street",
  "HouseNo",
  "PostalCode",
  "City",
  "Country",
  "Phone",
  "Email",
  "SenderNumber",
  "Weight",
  "Colli",
  "PackagingCode",
  "Reference",
];

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildRow(row: GlsImportRow): string[] {
  return [
    row.name,
    row.street,
    row.houseNo,
    row.zipCode,
    row.city,
    row.countryCode,
    row.phone,
    row.email,
    row.senderNumber,
    "1",
    "1",
    "Parcel",
    row.orderNumber,
  ];
}

export function buildGlsImportCsv(rows: GlsImportRow[]): string {
  const lines = [CSV_HEADERS, ...rows.map(buildRow)];
  return lines.map((fields) => fields.map(escapeCsvField).join(",")).join("\r\n") + "\r\n";
}
