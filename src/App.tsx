import { useCallback, useEffect, useRef, useState } from "react";
import { DeliveryApiError, openDelivery, readToken, requestFile } from "./api";
import type { ApiError, Asset, DeliveryPayload } from "./types";
import { GiftBox } from "./components/GiftBox";
import { VisitingCard } from "./components/VisitingCard";
import { ProjectPage } from "./components/ProjectPage";

type Stage = "wrapped" | "opening" | "card" | "page";
type State =
  | { kind: "loading" }
  | { kind: "error"; code: ApiError }
  | { kind: "ready"; data: DeliveryPayload };

const OPEN_MS = 1700;
const reducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function rememberKey(token: string) {
  return `stb-delivery-opened:${token.slice(-8)}`;
}
function wasOpened(token: string) {
  try { return localStorage.getItem(rememberKey(token)) === "1"; } catch { return false; }
}
function markOpened(token: string) {
  try { localStorage.setItem(rememberKey(token), "1"); } catch { /* storage unavailable: fine */ }
}

export function App() {
  const [token] = useState(() => readToken());
  const [state, setState] = useState<State>(() => (token ? { kind: "loading" } : { kind: "error", code: "not_found" }));
  const [stage, setStage] = useState<Stage>("wrapped");
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!token) return;
    let live = true;
    openDelivery(token)
      .then((data) => {
        if (!live) return;
        document.documentElement.dataset.theme = data.delivery.theme; // before first paint: no colour transition
        setState({ kind: "ready", data });
        if (!data.preview && wasOpened(token)) setStage("page");
      })
      .catch((e) => live && setState({ kind: "error", code: e instanceof DeliveryApiError ? e.code : "server_error" }));
    return () => { live = false; };
  }, [token]);

  useEffect(() => {
    if (state.kind !== "ready") return;
    const d = state.data.delivery;
    document.title = stage === "page" ? `${d.project_title}, delivered` : `For ${d.client_name}`;
    document.documentElement.dataset.theme = d.theme;
  }, [state, stage]);

  useEffect(() => {
    if (stage !== "opening") return;
    const t = setTimeout(() => setStage("card"), OPEN_MS);
    return () => clearTimeout(t);
  }, [stage]);

  // The "Open your gift" button disappears when clicked: move focus to the next action.
  useEffect(() => {
    if (stage === "card") nextRef.current?.focus({ preventScroll: true });
  }, [stage]);

  const open = () => setStage(reducedMotion() ? "card" : "opening");
  const toPage = () => {
    if (token && state.kind === "ready" && !state.data.preview) markOpened(token);
    setStage("page");
    window.scrollTo({ top: 0 });
  };

  const download = useCallback(async (asset: Asset) => {
    if (!token) return;
    const { url } = await requestFile(token, asset.id);
    window.location.assign(url); // signed URL carries Content-Disposition: attachment
  }, [token]);

  if (state.kind === "loading") return <Loading />;
  if (state.kind === "error") return <ErrorScreen code={state.code} />;

  const { data } = state;
  return (
    <>
      {data.preview && (
        <p className="preview-bar" role="status">
          Preview. Only people with this link can see it, and it expires within an hour. Opens are not counted.
        </p>
      )}
      {stage === "page" ? (
        <ProjectPage data={data} onDownload={download} onReplay={() => setStage("wrapped")} />
      ) : (
        <div className="wrap">
          <p className="wrap__brand">{data.card?.brand_name ?? "Sam Tech Builds"}</p>
          <GiftBox delivery={data.delivery} stage={stage} onOpen={open} onSkip={toPage}>
            {stage === "card" && (
              <div className="card-stage">
                {data.card && <VisitingCard card={data.card} />}
                <button type="button" className="btn btn--ribbon btn--large card-stage__next" onClick={toPage} ref={nextRef}>
                  See your project
                </button>
              </div>
            )}
          </GiftBox>
        </div>
      )}
    </>
  );
}

function Loading() {
  return (
    <div className="wrap wrap--center" aria-busy="true">
      <div className="loading-box" aria-hidden="true" />
      <p className="wrap__status" role="status">Unwrapping your delivery…</p>
    </div>
  );
}

const ERRORS: Record<ApiError, { title: string; body: string }> = {
  not_found: {
    title: "This link isn't active",
    body: "It may have expired, been replaced with a new link, or been copied incompletely. Ask Sam Tech Builds for a fresh link.",
  },
  rate_limited: {
    title: "Too many attempts",
    body: "This connection has made too many requests. Wait about ten minutes, then open your link again.",
  },
  network: {
    title: "You're offline",
    body: "Your delivery couldn't load. Check your internet connection and reload the page.",
  },
  server_error: {
    title: "Your delivery didn't load",
    body: "Something went wrong on our side. Reload the page in a minute; if it keeps happening, contact Sam Tech Builds.",
  },
  bad_request: {
    title: "This link isn't active",
    body: "The link looks incomplete. Ask Sam Tech Builds for a fresh link.",
  },
  not_configured: {
    title: "Delivery site not configured",
    body: "VITE_DELIVERY_API_URL is not set for this build.",
  },
};

function ErrorScreen({ code }: { code: ApiError }) {
  const e = ERRORS[code];
  const email = import.meta.env.VITE_STB_CONTACT_EMAIL as string | undefined;
  const site = import.meta.env.VITE_STB_WEBSITE as string | undefined;
  return (
    <div className="wrap wrap--center">
      <div className="notice">
        <h1>{e.title}</h1>
        <p>{e.body}</p>
        <div className="notice__actions">
          {(code === "network" || code === "server_error") && (
            <button type="button" className="btn btn--ribbon" onClick={() => window.location.reload()}>Reload</button>
          )}
          {email && <a className="btn btn--ghost btn--on-wrap" href={`mailto:${email}`}>Email Sam Tech Builds</a>}
          {site && <a className="btn-link btn-link--on-wrap" href={site}>Visit samtechbuilds</a>}
        </div>
      </div>
    </div>
  );
}
