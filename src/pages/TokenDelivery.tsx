/**
 * Private token delivery page — the original flow, now mounted at /reveal/*
 * and at the hash-fragment root (/#<token>).
 *
 * This component is a direct lift of the existing App component logic.
 * Token reading, the gift-box animation, file downloads and all error
 * handling are preserved exactly.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DeliveryApiError,
  clearSessionToken,
  openDelivery,
  readTokenWithFallback,
  requestFile,
} from "../api";
import type { ApiError, Asset, GiftItem, DeliveryPayload } from "../types";
import { GiftBox } from "../components/GiftBox";
import { VisitingCard } from "../components/VisitingCard";
import { ProjectPage } from "../components/ProjectPage";
import { showsGift } from "../sections";

type Stage = "wrapped" | "opening" | "card" | "page";
type State =
  | { kind: "loading" }
  | { kind: "error"; code: ApiError }
  | { kind: "ready"; data: DeliveryPayload };

const OPEN_MS = 1700;
const reducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function rememberKey(token: string) {
  return `stb-delivery-opened:${token.slice(-8)}`;
}
function wasOpened(token: string) {
  try { return localStorage.getItem(rememberKey(token)) === "1"; } catch { return false; }
}
function markOpened(token: string) {
  try { localStorage.setItem(rememberKey(token), "1"); } catch { /* ok */ }
}

export function TokenDelivery() {
  const [token] = useState(() => readTokenWithFallback());
  const [state, setState] = useState<State>(() =>
    token ? { kind: "loading" } : { kind: "error", code: "not_found" },
  );
  const [stage, setStage] = useState<Stage>("wrapped");
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!token) return;
    let live = true;
    openDelivery(token)
      .then((data) => {
        if (!live) return;
        document.documentElement.dataset.theme = data.delivery.theme;
        setState({ kind: "ready", data });
        if (!data.preview && wasOpened(token)) setStage("page");
      })
      .catch((e) => {
        if (!live) return;
        const code = e instanceof DeliveryApiError ? e.code : "server_error";
        // Clear the sessionStorage entry on definitive failures so a stale token
        // does not survive a reload. Transient failures (network, server_error,
        // rate_limited) leave it in place so the user can reload and retry.
        if (code === "not_found" || code === "bad_request") clearSessionToken();
        setState({ kind: "error", code });
      });
    return () => { live = false; };
  }, [token]);

  useEffect(() => {
    if (state.kind !== "ready") return;
    const d = state.data.delivery;
    document.title =
      stage === "page"
        ? `${d.project_title}, delivered`
        : `For ${d.client_name}`;
    document.documentElement.dataset.theme = d.theme;
  }, [state, stage]);

  useEffect(() => {
    if (stage !== "opening") return;
    const t = setTimeout(() => setStage("card"), OPEN_MS);
    return () => clearTimeout(t);
  }, [stage]);

  useEffect(() => {
    if (stage === "card") nextRef.current?.focus({ preventScroll: true });
  }, [stage]);

  const open = () => setStage(reducedMotion() ? "card" : "opening");
  const toPage = () => {
    if (token && state.kind === "ready" && !state.data.preview) markOpened(token);
    setStage("page");
    window.scrollTo({ top: 0 });
  };

  const download = useCallback(
    async (asset: Asset | GiftItem) => {
      if (!token) return;
      const { url } = await requestFile(token, asset.id);
      window.location.assign(url);
    },
    [token],
  );

  if (state.kind === "loading") return <Loading />;
  if (state.kind === "error") return <ErrorScreen code={state.code} />;

  const { data } = state;
  // The owner can switch the gift off: then the client lands straight on the project page.
  const gift = showsGift(data.delivery);
  const current: Stage = gift ? stage : "page";
  const giftStage: Exclude<Stage, "page"> = stage === "page" ? "wrapped" : stage;
  return (
    <>
      {data.preview && (
        <p className="preview-bar" role="status">
          Preview. Only people with this link can see it, and it expires within
          an hour. Opens are not counted.
        </p>
      )}
      {current === "page" ? (
        <ProjectPage
          data={data}
          onDownload={download}
          onReplay={gift ? () => setStage("wrapped") : undefined}
        />
      ) : (
        <div className="wrap">
          <p className="wrap__brand">
            {data.card?.brand_name ?? "Sam Tech Builds"}
          </p>
          <GiftBox
            delivery={data.delivery}
            giftItems={data.gift_items}
            stage={giftStage}
            onOpen={open}
            onSkip={toPage}
            onRequestFile={download}
          >
            {stage === "card" && (
              <div className="card-stage">
                {data.card && <VisitingCard card={data.card} />}
                <button
                  type="button"
                  className="btn btn--ribbon btn--large card-stage__next"
                  onClick={toPage}
                  ref={nextRef}
                >
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

/* ——— Shared UI (identical to the original App) ——— */

function Loading() {
  return (
    <div className="wrap wrap--center" aria-busy="true">
      <div className="loading-box" aria-hidden="true" />
      <p className="wrap__status" role="status">
        Unwrapping your delivery…
      </p>
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
            <button
              type="button"
              className="btn btn--ribbon"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          )}
          {email && (
            <a
              className="btn btn--ghost btn--on-wrap"
              href={`mailto:${email}`}
            >
              Email Sam Tech Builds
            </a>
          )}
          {site && (
            <a className="btn-link btn-link--on-wrap" href={site}>
              Visit samtechbuilds
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
