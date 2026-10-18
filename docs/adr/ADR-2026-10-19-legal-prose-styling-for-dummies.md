# ADR for Dummies: Make the legal pages readable

- **Status:** Accepted (maintainer approved 2026-10-19)
- **Date:** 2026-10-19

## The Idea

The Terms, Privacy and Acceptable Use pages look like one long block of text.

- Section titles are the same size as the paragraphs.
- Lists have no bullet points.
- There's no space between paragraphs.

The pages were written to use a standard add-on that formats long text, but the add-on was never installed. We'll install it and colour it with Strimz's own colours.

## What the Person Sees

- Clear section headings, bullet points, space between paragraphs, and green links.
- The pages look right in both light and dark mode.
- Clicking a section in "On this page" scrolls to that heading without the menu bar covering it.
- In the admin area, the broadcast editor shows bold text, lists and headings properly while you type.

## Important Limitation

- This changes how the legal pages look, not what they say. Their wording is a separate question.

## What Changes

- One small add-on that only affects how text is styled, with nothing extra loaded in the visitor's browser.
- A Strimz colour theme for long text, which follows the light/dark switch.
- An automatic check, so the site fails its tests if this styling is ever used without the add-on again.

## What Does Not Change

- The words on the legal pages.
- Every other page.
