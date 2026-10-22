## UI Pro Max Stack Guidelines
**Stack:** react | **Query:** table filtering state
**Source:** stacks/react.csv | **Found:** 3 results

### Result 1
- **Category:** Forms
- **Guideline:** Debounce rapid input changes
- **Description:** Debounce search/filter inputs
- **Do:** useDeferredValue or debounce for search
- **Don't:** Filter on every keystroke
- **Code Good:** useDeferredValue(searchTerm)
- **Code Bad:** useEffect filtering on every change
- **Severity:** Medium
- **Docs URL:** https://react.dev/reference/react/useDeferredValue
- **Applies To:** react 19.2.x
- **Status:** active
- **Verified At:** 2026-08-13

### Result 2
- **Category:** State
- **Guideline:** Lift state up when needed
- **Description:** Share state between siblings by lifting to parent
- **Do:** Lift shared state to common ancestor
- **Don't:** Prop drilling through many levels
- **Code Good:** Parent holds state passes down
- **Code Bad:** Deep prop chains
- **Severity:** Medium
- **Docs URL:** https://react.dev/learn/sharing-state-between-components
- **Applies To:** react 19.2.x
- **Status:** active
- **Verified At:** 2026-08-13

### Result 3
- **Category:** State
- **Guideline:** Use useState for local state
- **Description:** Simple component state should use useState hook in current React apps.
- **Do:** useState for form inputs toggles counters
- **Don't:** Class components this.state
- **Code Good:** const [count, setCount] = useState(0)
- **Code Bad:** this.state = { count: 0 }
- **Severity:** Medium
- **Docs URL:** https://react.dev/reference/react/useState
- **Applies To:** react 19.2.x
- **Status:** active
- **Verified At:** 2026-08-13

