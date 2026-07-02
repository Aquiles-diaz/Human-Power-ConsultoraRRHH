import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { JsonLd } from "./JsonLd";

describe("JsonLd", () => {
  it("escapa < para que un </script> en los datos no rompa el tag", () => {
    const { container } = render(
      <JsonLd data={{ name: "</script><script>alert(1)</script>" }} />
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script?.innerHTML).not.toContain("<");
    expect(JSON.parse(script!.innerHTML).name).toBe("</script><script>alert(1)</script>");
  });
});
