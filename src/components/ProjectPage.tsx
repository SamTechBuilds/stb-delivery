import { useEffect, useRef, useState } from "react";
import type { Asset, DeliveryPayload } from "../types";
import { daysUntil, formatBytes, formatDate, hostOf, safeUrl, supportProgress, videoEmbed, whatsappLink } from "../format";
import { VisitingCard } from "./VisitingCard";

interface Props {
  data: DeliveryPayload;
  onDownload: (asset: Asset) => Promise<void>;
  onReplay?: () => void;
}

export function ProjectPage({ data, onDownload, onReplay }: Props) {
  const { delivery: d, support, card, assets } = data;
  const shots = assets.filter((a) => a.kind === "screenshot" && a.url);
  const docs = assets.filter((a) => a.kind === "document");
  const live = safeUrl(d.live_url);
  const embed = videoEmbed(d.video_url);
  const videoLink = !embed ? safeUrl(d.video_url) : null;
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <main className="page" id="project">
      <header className="reveal">
        <div className="reveal__text">
          <p className="reveal__for">
            {d.business_name ? `${d.business_name}, ` : ""}{formatDate(d.completed_on) ? `delivered ${formatDate(d.completed_on)}` : "delivered by Sam Tech Builds"}
          </p>
          <h1 className="reveal__title" ref={headingRef} tabIndex={-1}>{d.project_title}</h1>
          {d.project_summary && <p className="reveal__summary">{d.project_summary}</p>}
          <div className="reveal__actions">
            {live && (
              <a className="btn btn--ribbon btn--large" href={live} target="_blank" rel="noopener noreferrer">
                Visit {hostOf(live)}
              </a>
            )}
            {onReplay && <button type="button" className="btn-link" onClick={onReplay}>Open the gift again</button>}
          </div>
          {d.tech_list.length > 0 && (
            <p className="reveal__tech"><span>Built with</span> {d.tech_list.join(", ")}</p>
          )}
        </div>
        {shots[0] && (
          <figure className="browser">
            <div className="browser__bar" aria-hidden="true">
              <span /><span /><span />
              <p>{live ? hostOf(live) : d.project_title}</p>
            </div>
            <img src={shots[0].url!} alt={shots[0].title} />
          </figure>
        )}
      </header>

      {shots.length > 1 && <Gallery shots={shots.slice(1)} />}

      {(embed || videoLink) && (
        <section className="block" aria-labelledby="video-h">
          <h2 id="video-h">Walkthrough</h2>
          {embed ? (
            <div className="video">
              <iframe src={embed} title={`${d.project_title} walkthrough`} loading="lazy"
                allow="encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" />
            </div>
          ) : (
            <a className="btn btn--ghost" href={videoLink!} target="_blank" rel="noopener noreferrer">Watch the walkthrough</a>
          )}
        </section>
      )}

      {(docs.length > 0 || d.handover_checklist.length > 0) && (
        <section className="block" aria-labelledby="handover-h">
          <h2 id="handover-h">Your handover</h2>
          <p className="block__lead">Everything you need to run your website. Download links are created when you click and last two minutes.</p>
          <div className="handover">
            {docs.length > 0 && (
              <ul className="files">
                {docs.map((doc) => <FileRow key={doc.id} asset={doc} onDownload={onDownload} />)}
              </ul>
            )}
            {d.handover_checklist.length > 0 && (
              <div className="checklist">
                <h3>Handover checklist</h3>
                <ul>
                  {d.handover_checklist.map((item, i) => (
                    <li key={i} className={item.done ? "is-done" : ""}>
                      <span className="checklist__mark" aria-hidden="true">{item.done ? "✓" : ""}</span>
                      {item.label}
                      <span className="sr-only">{item.done ? " (done)" : " (to do)"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {support && <SupportBlock support={support} note={d.support_contact_note} whatsapp={card?.whatsapp ?? null}
        email={card?.email ?? null} phone={card?.phone ?? null} hours={card?.support_hours ?? null} project={d.project_title} />}

      {card && (
        <section className="block block--card" aria-labelledby="card-h">
          <h2 id="card-h">Keep in touch</h2>
          <VisitingCard card={card} compact />
        </section>
      )}

      <footer className="page__footer">
        {d.closing_message && <p className="page__closing">{d.closing_message}</p>}
        <p>Delivered by {card?.brand_name ?? "Sam Tech Builds"}. Keep this link private; it opens your project page.</p>
      </footer>
    </main>
  );
}

function Gallery({ shots }: { shots: Asset[] }) {
  const [open, setOpen] = useState<Asset | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal?.();
    if (!open && el.open) el.close?.();
  }, [open]);

  return (
    <section className="block" aria-labelledby="gallery-h">
      <h2 id="gallery-h">More screens</h2>
      <ul className="gallery">
        {shots.map((s) => (
          <li key={s.id}>
            <button type="button" className="gallery__item" onClick={() => setOpen(s)}>
              <img src={s.url!} alt="" loading="lazy" />
              <span>{s.title}</span>
            </button>
            {s.description && <p className="gallery__desc">{s.description}</p>}
          </li>
        ))}
      </ul>
      <dialog ref={dialog} className="lightbox" onClose={() => setOpen(null)} onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
        {open && (
          <figure>
            <img src={open.url!} alt={open.title} />
            <figcaption>
              {open.title}
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setOpen(null)}>Close</button>
            </figcaption>
          </figure>
        )}
      </dialog>
    </section>
  );
}

function FileRow({ asset, onDownload }: { asset: Asset; onDownload: (a: Asset) => Promise<void> }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const ext = asset.file_name.includes(".") ? asset.file_name.split(".").pop()!.slice(0, 4).toLowerCase() : "file";
  const click = async () => {
    setState("busy");
    try {
      await onDownload(asset);
      setState("idle");
    } catch {
      setState("error");
    }
  };
  return (
    <li className="file">
      <span className="file__type" aria-hidden="true">{ext}</span>
      <div className="file__text">
        <p className="file__title">{asset.title}</p>
        <p className="file__meta">{asset.file_name}, {formatBytes(asset.size_bytes)}</p>
        {asset.description && <p className="file__desc">{asset.description}</p>}
        {state === "error" && <p className="file__error" role="alert">The download didn't start. Check your connection and try again.</p>}
      </div>
      <button type="button" className="btn btn--ink btn--small" onClick={click} disabled={state === "busy"}
        aria-label={`Download ${asset.title}`}>
        {state === "busy" ? "Preparing…" : "Download"}
      </button>
    </li>
  );
}

interface SupportProps {
  support: NonNullable<DeliveryPayload["support"]>;
  note: string | null;
  whatsapp: string | null;
  email: string | null;
  phone: string | null;
  hours: string | null;
  project: string;
}

function SupportBlock({ support, note, whatsapp, email, phone, hours, project }: SupportProps) {
  const left = daysUntil(support.ends_on);
  const active = left >= 0;
  const progress = supportProgress(support.starts_on, support.ends_on);
  const wa = whatsappLink(whatsapp, `Hi, I need help with ${project}.`);
  return (
    <section className="block" aria-labelledby="support-h">
      <h2 id="support-h">Support</h2>
      <div className={`support${active ? "" : " support--ended"}`}>
        <div className="support__status">
          <p className="support__plan">{support.plan_name}</p>
          <p className="support__until">
            {active ? <>Covered until <strong>{formatDate(support.ends_on)}</strong></> : <>Ended on <strong>{formatDate(support.ends_on)}</strong></>}
          </p>
          <div className="meter" role="img" aria-label={active ? `${left} days of support left` : "Support period has ended"}>
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="support__days">
            {active ? (left === 0 ? "Last day of cover." : `${left} ${left === 1 ? "day" : "days"} left.`) : "Ask us about renewing your support plan."}
            {" "}Started {formatDate(support.starts_on)}.
          </p>
        </div>
        <div className="support__terms">
          {support.terms && <p className="support__terms-text">{support.terms}</p>}
          {note && <p>{note}</p>}
          {hours && <p className="support__hours">{hours}</p>}
          <div className="support__actions">
            {wa && <a className="btn btn--ink" href={wa} target="_blank" rel="noopener noreferrer">Ask for help on WhatsApp</a>}
            {email && <a className="btn btn--ghost" href={`mailto:${email}?subject=${encodeURIComponent(`Support: ${project}`)}`}>Email support</a>}
            {phone && <a className="btn btn--ghost" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>Call</a>}
          </div>
        </div>
      </div>
    </section>
  );
}
