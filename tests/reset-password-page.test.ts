import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResetPasswordScreen } from "@/components/reset-password-screen";

describe("reset password screen", () => {
  it("matches the login colors and asks for a new password twice", () => {
    const html = renderToStaticMarkup(createElement(ResetPasswordScreen, { error: "", pending: false, onSubmit: () => undefined }));
    expect(html).toContain("Set a new password");
    expect(html).toContain("New password");
    expect(html).toContain("Confirm password");
    expect(html).toContain("Save new password");
    expect(html).toContain('type="password"');
    expect(html).toContain('minLength="8"');
    expect(html).toContain("Show new password");
    expect(html).toContain("Show password confirmation");
    expect(html).toContain("At least 8 characters.");
    expect(html).toContain("#07421F");
    expect(html).toContain("#C9A227");
    expect(html).toContain("#f4f1ea");
    expect(html).toContain("rgba(201,162,39,0.16)");
    expect(html).toContain("rgba(7,66,31,0.55)");
  });
});
