/**
 * Public slug delivery page.
 *
 * Renders /:slug — a published delivery fetched through the delivery-public
 * Edge Function. Reuses the same ProjectPage, GiftBox and VisitingCard
 * components as the private token path.
 *
 * Key differences from the token path:
 *   - No file downloads (documents require a token link).
 *   - No preview bar (the slug endpoint only returns published deliveries).
 *   - The gift-box animation is optional and skippable.
 *   - The page title is slug-based.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { normaliseSlug, openBySlug } from "../slug-api";
import { DeliveryApiError } from "../api";
import type { ApiError, Asset, DeliveryPayload } from "../types";
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

function slugKey(slug: string) {
  return `stb-delivery-slug-opened:${slug}`;
}
function wasSlugOpened(slug: string) {
  try { return localStorage.getItem(slugKey(slug)) === "1"; } catch { return false; }
}
function markSlugOpened(slug: string) {
  try { localStorage.setItem(slugKey(slug), "1"); } catch { /* ok */ }
}

export function SlugDelivery() {
  const { slug: rawSlug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const slug = rawSlug ? normaliseSlug(rawSlug) : null;

  const [state, setState] = useState<State>({ kind: "loading" });
  const [stage, setStage] = useState<Stage>("wrapped");
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!slug) return; // an invalid slug is rendered as not_found below, without any request
    let live = true;
    openBySlug(slug)
      .then((data) => {
        if (!live) return;
        document.documentElement.dataset.theme = data.delivery.theme;
        setState({ kind: "ready", data });
        if (wasSlugOpened(slug)) setStage("page");
      })
      .catch((e) => {
        if (!live) return;
        setState({
          kind: "error",
          code: e instanceof DeliveryApiError ? e.code : "server_error",
        });
      });
    return () => { live = false; };
  }, [slug]);

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
    if (slug) markSlugOpened(slug);
    setStage("page");
    window.scrollTo({ top: 0 });
  };

  // Slug deliveries do not support file downloads — documents require a token link.
  const download = useCallback(async (_asset: Asset) => {
    // No-op: the slug endpoint does not provide download URLs.
    // Document assets are not shown in the slug view (filtered below).
  }, []);

  const view: State = slug ? state : { kind: "error", code: "not_found" };
  if (view.kind === "loading") return <Loading />;
  if (view.kind === "error") return <ErrorScreen code={view.code} onHome={() => navigate("/")} />;

  const { data } = view;

  // The owner can switch the gift off: then the client lands straight on the project page.
  const gift = showsGift(data.delivery);
  const current: Stage = gift ? stage : "page";
  const giftStage: Exclude<Stage, "page"> = stage === "page" ? "wrapped" : stage;

  // Filter out document assets — they require token-based access.
  const slugData: DeliveryPayload = {
    ...data,
    assets: data.assets.filter((a) => a.kind === "screenshot"),
    preview: false, // slug endpoint never returns previews
  };

  return (
    <>
      {current === "page" ? (
        <ProjectPage data={slugData} onDownload={download} onReplay={gift ? () => setStage("wrapped") : undefined} />
      ) : (
        <div className="wrap">
          <p className="wrap__brand">{data.card?.brand_name ?? "Sam Tech Builds"}</p>
          <GiftBox delivery={data.delivery} giftItems={data.gift_items} stage={giftStage} onOpen={open} onSkip={toPage}>
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

/* ——— Shared UI ——— */

function Loading() {
  return (
    <div className="wrap wrap--center" aria-busy="true">
      <div className="loading-box" aria-hidden="true" />
      <p className="wrap__status" role="status">Loading your delivery…</p>
    </div>
  );
}

const ERRORS: Record<ApiError, { title: string; body: string }> = {
  not_found: {
    title: "This project wasn't found",
    body: "The page may not exist, or it hasn't been published yet. Check the link or contact Sam Tech Builds.",
  },
  rate_limited: {
    title: "Too many requests",
    body: "This connection has made too many requests. Wait about ten minutes and try again.",
  },
  network: {
    title: "You're offline",
    body: "Check your internet connection and reload the page.",
  },
  server_error: {
    title: "Something went wrong",
    body: "We couldn't load this delivery. Reload the page in a minute; if it keeps happening, contact Sam Tech Builds.",
  },
  bad_request: {
    title: "Invalid link",
    body: "This link doesn't look right. Check it and try again.",
  },
  not_configured: {
    title: "Delivery site not configured",
    body: "The delivery service is not properly configured.",
  },
};

function ErrorScreen({ code, onHome }: { code: ApiError; onHome?: () => void }) {
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
            <button type="button" className="btn btn--ribbon" onClick={() => window.location.reload()}>
              Reload
            </button>
          )}
          {onHome && (
            <button type="button" className="btn btn--ghost btn--on-wrap" onClick={onHome}>
              Go home
            </button>
          )}
          {email && (
            <a className="btn btn--ghost btn--on-wrap" href={`mailto:${email}`}>
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
