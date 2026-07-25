import { describe, expect, it } from "vitest";
import { GlsApiError } from "../errors";

describe("GlsApiError", () => {
  it("stores the http status, gls status, and gls errors", () => {
    const err = new GlsApiError("Something went wrong", 422, "422", { zipCode: "invalid" });

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("GlsApiError");
    expect(err.message).toBe("Something went wrong");
    expect(err.httpStatus).toBe(422);
    expect(err.glsStatus).toBe("422");
    expect(err.glsErrors).toEqual({ zipCode: "invalid" });
  });

  it("allows glsStatus and glsErrors to be omitted", () => {
    const err = new GlsApiError("Unexpected failure", 500);

    expect(err.glsStatus).toBeUndefined();
    expect(err.glsErrors).toBeUndefined();
  });
});
