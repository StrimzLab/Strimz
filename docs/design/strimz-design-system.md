# Strimz design system

Taken from the Strimz UI Library (Figma, exported 2026-11-14, 81 frames) and the brand guideline. Hex values were sampled from the exports. This file is the reference for every Strimz web surface: marketing, docs, dashboard, admin and checkout. Fanline has its own brand and is out of scope.

## Colour scales

| Step | Brand (green) | Deep blue | Gray    |
| ---- | ------------- | --------- | ------- |
| 100  | #014C28       | #050020   | #111928 |
| 90   | #01753E       | #090037   | #1F2A37 |
| 80   | #028D4B       | #0C004F   | #374151 |
| 70   | #02C76A       | #100066   | #4B5563 |
| 60   | #02F080       | #281C67   | #6B7280 |
| 50   | #33F398       | #403969   | #9CA3AF |
| 40   | #63F6B1       | #58556A   | #D1D5DB |
| 30   | #94F9C9       | #8E8C9C   | #E5E7EB |
| 20   | #C4FCE2       | #E4E3E8   | #F3F4F6 |
| 10   | #F5FFFA       | #FBFAFF   | #F9FAFB |

Red: 100 #9B1C1C, 50 #FBD5D5, 20 #FDE8E8, 10 #FDF2F2. Yellow: 100 #723B13, 50 #FCE96A, 20 #FDF6B2, 10 #FDFDEA.

Brand guideline core: green #02F080, navy #050020, white. Brand dark artwork uses navy with teal #06222E shapes.

## Semantic tokens (light)

| Token                            | Value                     | Use                                  |
| -------------------------------- | ------------------------- | ------------------------------------ |
| surface/primary                  | #FFFFFF                   | page, cards                          |
| surface/secondary                | #F9FAFB                   | panels, inputs, sidebar, table heads |
| surface/neutral                  | #050020                   | dark brand surfaces                  |
| surface/brandAccent              | #028D4B                   | solid brand fill                     |
| surface/brandAccentLight         | #F5FFFA                   | success and brand tint               |
| surface/stateDisabled            | #E4E3E8                   | disabled controls                    |
| surface/warningLight, warn       | #FFFAEB, #B54708          |                                      |
| surface/dangerLight, danger      | #FEF3F2, #B42318          |                                      |
| border/primary                   | #E5E7EB                   | every hairline                       |
| border/secondary                 | #100066                   | focused field                        |
| border/brandAccent, light        | #028D4B, #94F9C9          |                                      |
| border/warning                   | #FEC84B                   |                                      |
| border/dangerLight, danger       | #FDA29B, #B42318          |                                      |
| content/primary                  | #050020                   | headings, values                     |
| content/secondary                | #58556A                   | body, labels                         |
| content/tertiary                 | #8E8C9C                   | hints, meta                          |
| content/brandAccent              | #028D4B                   | green text and links                 |
| content/success, warning, danger | #028D4B, #B54708, #B42318 |                                      |

## Type

- **Titles:** Sora SemiBold with tight tracking: 32/40, 24/36, 20/30.
- **Body and UI:** Poppins Regular: 18/24, 16/24, 14/24, 12/20. Labels and buttons use Poppins Medium.
- **Logo:** the brand guideline reserves Sora for the logotype; the UI library extends it to titles.

## Shape, depth, icons

- **Radius:** 8 px for controls and table rows, 12 px for menus, toasts and inner cards, 16 px for shells. Pills are only for avatars, status dots and the status chip ends.
- **Shadow:** the Tailwind scale (`sm` to `2xl`), soft grey. Cards use `sm`; menus, date pickers and toasts use `md` or `lg`.
- **Icons:** Untitled UI line icons, about 2 px stroke, in content/primary or content/secondary.

## Components

- **Buttons** are 8 px rectangles at 40 px or 32 px high.
  - **Primary:** a vertical gradient from #02C569 to #01A357 with white text. Hover is a flat #02A658. Pressed or focused adds a #94F9C9 ring and an inset shadow.
  - **Secondary:** #F9FAFB background, #E5E7EB border, #58556A text, which turns navy on hover.
  - **Outline:** white background, #E5E7EB border, navy text.
  - **Danger soft:** #FDF2F2 background with #9B1C1C text.
  - **Danger outline:** white background, pink border, red text.
  - **Ghost:** no background.
  - **Disabled:** #E5E7EB background with grey text.
  - **Loading:** "Processing" with a spinner.
- **Inputs and selects:**
  - **Label:** 14 px, #58556A, above the field.
  - **Field:** #F9FAFB, a 1 px #E5E7EB border, 8 px radius, 48 px tall.
  - **Text:** placeholder in #6B7280, value in navy.
  - **Focus:** a 1.5 px #100066 border, with no glow.
  - **Disabled:** #F3F4F6.
- **Status chips:** 8–10 px radius, no border.
  - **Colours:** success #E7FEF3/#01753E, warning #FDFDEA/#723B13, neutral #F0F2F4/#050020, danger #FDF2F2/#9B1C1C.
  - **Ring-dot variant:** a dot plus a #58556A label. The dot is #02C76A for completed, #FCE96A for in progress, #9B1C1C for failed.
- **Tabs:** underline style. The active tab is navy SemiBold with a 2 px navy underline; inactive tabs are #58556A.
- **Checkbox and radio:** unchecked is #F9FAFB with a #E5E7EB ring; checked is a #02C76A fill with a white mark.
- **Sidebar:**
  - **Panel:** #F9FAFB.
  - **Items:** icon and label in #58556A.
  - **Hover:** #F3F4F6.
  - **Active:** a white card with a #E5E7EB border, `shadow-sm`, and a navy SemiBold label.
- **Title bar:**
  - **Bar:** white with a bottom border.
  - **Title:** Sora SemiBold with a #58556A subtitle.
  - **Right side:** a wallet chip and an account chip.
- **Tables:**
  - **Lines:** row dividers only, in #E5E7EB, with no vertical rules.
  - **Header:** #58556A on #F9FAFB.
  - **Amounts:** shown as "8.00 USDC", with the value navy Medium and the code #58556A.
  - **Footer:** "1 - 20 of 120 items", a page-size select, and ‹ › controls.
- **Toasts:**
  - **Full:** a white card with a 12 px radius, a status icon in a tinted circle, a navy title and a #58556A body, an optional primary action and a ×.
  - **Compact:** a tinted background with a matching border.
- **Menus:** white, a #E5E7EB border, 12 px radius, `shadow-lg`. Rows are #58556A with an #F3F4F6 hover.
- **Date picker:** the selected day is a navy square with a white number.
- **Cards:** white or #F9FAFB, a #E5E7EB border, 16 px radius, `shadow-sm`.
- **Metric shell:** #F9FAFB, holding a white inner card split by #E5E7EB lines.
- **Promo cards:** the only gradient surface. A diagonal navy-to-deep-green gradient (#050522 to #045E45) with faint logo line-art, white Sora title, white button.
- **Brand pattern:** the tilted "S" mark repeated (white on navy, green on navy, white on green). Use it only on brand surfaces: promo cards, the closing call to action, the footer and social images.

## Dark mode

The library draws light mode only. Dark mode is derived from the brand's dark artwork: a navy base with green and teal accents.

| Role                 | Value                           |
| -------------------- | ------------------------------- |
| page                 | #050020                         |
| card                 | #0D0A27                         |
| secondary surface    | #13102D                         |
| border               | #26233F                         |
| input border         | #34314C                         |
| content/primary      | #FFFFFF                         |
| content/secondary    | #B4B2C2                         |
| content/tertiary     | #8E8C9C                         |
| brand text and links | #02C76A                         |
| focus border         | #63F6B1                         |
| success chip         | rgba(2,199,106,.14) / #63F6B1   |
| warning chip         | rgba(254,200,75,.14) / #FEC84B  |
| danger chip          | rgba(253,162,155,.14) / #FDA29B |
