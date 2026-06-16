import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Checkbox } from "@/components/ui/checkbox"

describe("Checkbox", () => {
  it("renders with role checkbox and unchecked by default", () => {
    render(<Checkbox aria-label="accept" />)
    const cb = screen.getByRole("checkbox", { name: "accept" })
    expect(cb).not.toBeChecked()
  })

  it("toggles on click and fires onCheckedChange", async () => {
    const user = userEvent.setup()
    let last: boolean | "indeterminate" | undefined
    render(
      <Checkbox
        aria-label="accept"
        onCheckedChange={(v) => {
          last = v
        }}
      />
    )
    await user.click(screen.getByRole("checkbox", { name: "accept" }))
    expect(last).toBe(true)
    expect(screen.getByRole("checkbox", { name: "accept" })).toBeChecked()
  })

  it("supports indeterminate prop", () => {
    render(<Checkbox aria-label="mixed" checked="indeterminate" />)
    const cb = screen.getByRole("checkbox", { name: "mixed" }) as HTMLInputElement
    expect(cb.indeterminate).toBe(true)
    expect(cb.checked).toBe(false)
  })

  it("supports controlled checked=false", () => {
    render(<Checkbox aria-label="off" checked={false} />)
    const cb = screen.getByRole("checkbox", { name: "off" })
    expect(cb).not.toBeChecked()
  })

  it("forwards ref", () => {
    let captured: HTMLInputElement | null = null
    render(
      <Checkbox
        aria-label="ref"
        ref={(el) => {
          captured = el
        }}
      />
    )
    expect(captured).toBeInstanceOf(HTMLInputElement)
  })

  it("applies aria-invalid styling class", () => {
    const { container } = render(<Checkbox aria-label="x" aria-invalid />)
    const input = container.querySelector('input[type="checkbox"]')
    expect(input?.getAttribute("aria-invalid")).toBe("true")
  })
})
