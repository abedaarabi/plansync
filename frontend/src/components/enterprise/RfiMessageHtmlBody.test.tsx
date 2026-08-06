import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RfiMessageHtmlBody } from "./RfiMessageHtmlBody";

describe("RfiMessageHtmlBody", () => {
  it("renders legacy plain text without treating it as HTML", () => {
    render(<RfiMessageHtmlBody html="Plain reply <not-a-tag" />);
    expect(screen.getByText("Plain reply <not-a-tag")).toBeTruthy();
  });

  it("keeps TipTap tables, headings, and mentions after purify", () => {
    const { container } = render(
      <RfiMessageHtmlBody
        html={[
          "<h3>Detail</h3>",
          "<table><tr><th>Q</th><td>A</td></tr></table>",
          '<p><span data-type="mention" data-id="u1" data-label="Ada">@Ada</span></p>',
          "<script>alert(1)</script>",
        ].join("")}
      />,
    );
    const body = container.querySelector(".rfi-rich-body");
    expect(body).toBeTruthy();
    expect(body?.innerHTML).toContain("<h3>");
    expect(body?.innerHTML).toContain("<table>");
    expect(body?.innerHTML).toContain('data-type="mention"');
    expect(body?.innerHTML).not.toContain("<script>");
    expect(body?.innerHTML).not.toContain("alert");
  });
});
