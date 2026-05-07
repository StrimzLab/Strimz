# @strimz/ui

Shared shadcn/ui primitives configured with Strimz brand tokens. Distributed as **TypeScript source** — the consuming Next.js app compiles the Tailwind classes directly from these files.

## Brand

- **Primary** `#02C76A` — Strimz green. Available as `bg-primary`, `bg-strimz-500`, and friends across the full `strimz-50 … strimz-950` ramp.
- **Display font** Sora (headings, `font-display`).
- **Body font** Poppins (default, `font-sans`).

## What's inside

| Component                                                                                     | Import                                         |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `Button`                                                                                      | `@strimz/ui` or `@strimz/ui/components/button` |
| `Input`, `Textarea`, `Label`                                                                  | form primitives                                |
| `Card`, `CardHeader`, `CardContent`, `CardFooter`                                             | layout                                         |
| `Badge`                                                                                       | with `success` and `warning` variants          |
| `Separator`, `Skeleton`, `Avatar`                                                             | scaffolding                                    |
| `Dialog`, `AlertDialog`                                                                       | modals                                         |
| `DropdownMenu`, `Select`, `Tabs`                                                              | navigation + pickers                           |
| `Switch`, `Checkbox`, `RadioGroup`                                                            | binary + choice controls                       |
| `Table` and friends                                                                           | data display                                   |
| `Tooltip`, `TooltipProvider`                                                                  | help overlays                                  |
| `Toaster`, `toast`                                                                            | Sonner-backed notifications                    |
| `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage` | react-hook-form wrapper                        |
| `ThemeProvider`                                                                               | next-themes wrapper                            |

The `cn` utility (clsx + tailwind-merge) is exported at the package root and at `@strimz/ui/cn`.

## Wiring it into a Next.js 15 app

1. Install peer deps in the app: `tailwindcss@^4`, `react`, `react-dom`, `react-hook-form`.
2. In the root layout, import the stylesheet:

   ```ts
   import '@strimz/ui/globals.css'
   ```

3. Wire the theme provider:

   ```tsx
   import { ThemeProvider } from '@strimz/ui'

   export default function RootLayout({ children }) {
     return (
       <html lang="en" suppressHydrationWarning>
         <body>
           <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
             {children}
           </ThemeProvider>
         </body>
       </html>
     )
   }
   ```

4. Load the brand fonts (Next.js's `next/font`) and expose them as CSS variables `--font-sora` and `--font-poppins` on `<html>` or `<body>`. The `globals.css` wires those into `font-display` and `font-sans` automatically.

5. In the app's Tailwind source file, include `@strimz/ui`:

   ```css
   @source "../../node_modules/@strimz/ui";
   ```

## Boundaries

- **No build step.** Components ship as source; consumers own the compile.
- **No business logic.** Only presentation; wiring to data lives in the app.
- **No brand tokens copied elsewhere.** If a colour is used in more than one place, it comes from here.
- **Light + dark.** Every component respects the `--foreground` / `--background` / `--primary` CSS variables and flips correctly when the `.dark` class is applied by `next-themes`.
