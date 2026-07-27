import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ContestPlatformCard from "./ContestPlatformCard";

describe("ContestPlatformCard", () => {
  it("renders a full-width mobile-friendly card wrapper", () => {
    const markup = renderToStaticMarkup(
      <ContestPlatformCard
        title="CodeChef Contests"
        icon={<span>🏆</span>}
        description="Recent • Upcoming"
        href="/codechef-contests"
        gradientFrom="#6B46C1"
        gradientTo="#9F7AEA"
      />
    );

    expect(markup).toContain("w-full");
    expect(markup).toContain("min-w-0");
  });
});
