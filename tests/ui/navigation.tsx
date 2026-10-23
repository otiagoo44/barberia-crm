// Router adapter for isolated component tests, not an Auth or Next.js substitute.
import { useMemo, useSyncExternalStore, type ComponentProps } from "react";
const subscribe = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
};
const snapshot = () => window.location.pathname + window.location.search;
export function navigate(href: string) {
  history.pushState(null, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
export function usePathname() {
  return useSyncExternalStore(subscribe, snapshot).split("?")[0];
}
export function useSearchParams() {
  const url = useSyncExternalStore(subscribe, snapshot);
  return useMemo(() => new URLSearchParams(url.split("?")[1]), [url]);
}
export function useRouter() {
  return { push: navigate, replace: navigate, refresh: () => {} };
}
export default function Link({ href, onClick, ...props }: ComponentProps<"a">) {
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && href?.startsWith("/")) {
          event.preventDefault();
          navigate(href);
        }
      }}
    />
  );
}
