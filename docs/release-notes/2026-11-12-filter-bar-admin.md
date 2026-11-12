---
date: 2026-11-12
feature: The standard filter bar on the admin merchant list
scope: feat
scenario-impact: none
---

# Filter bar on admin merchants

Last step of the standard dashboard filter bar (#426, ADR-2026-11-12-table-filter-bar).

The admin merchant list replaces its status chips with the shared filter bar:

- **Search:** still runs on the server, as before.
- **Status:** active, suspended, closed. **Tier:** free, starter, growth, enterprise (new). Both take several values and are kept in the page address.
- **Clear filters:** appears when a filter or search is set and resets both.
- **Empty state:** says "No merchants match these filters." when filtered, and "No merchants yet." otherwise.
