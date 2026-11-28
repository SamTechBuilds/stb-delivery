import type { DeliveryInfo, GiftItem } from "../types";

interface Props {
  delivery: DeliveryInfo;
  giftItems?: GiftItem[];
  stage: "wrapped" | "opening" | "card";
  onOpen: () => void;
  onSkip: () => void;
  onRequestFile?: (item: GiftItem) => void;
  children?: React.ReactNode; // the visiting card, rendered rising out of the box
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime: string): string {
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.startsWith("video/")) return "🎥";
  if (mime.startsWith("audio/")) return "🎵";
  if (mime.includes("pdf")) return "📄";
  if (mime.includes("zip") || mime.includes("archive") || mime.includes("compressed")) return "📦";
  if (mime.includes("document") || mime.includes("word")) return "📝";
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return "📊";
  return "📎";
}

/** The welcome scene: a gift tag addressed to the client, hanging from a ribboned box. */
export function GiftBox({ delivery, giftItems, stage, onOpen, onSkip, onRequestFile, children }: Props) {
  const opened = stage !== "wrapped";
  const hasGifts = giftItems && giftItems.length > 0;

  return (
    <section className={`scene scene--${stage}`} aria-labelledby="tag-title">
      <div className="scene__stack">
        <figure className="tag" aria-hidden={opened ? true : undefined}>
          <span className="tag__hole" />
          <p className="tag__for">For</p>
          <p className="tag__name" id="tag-title">{delivery.client_name}</p>
          {delivery.business_name && <p className="tag__business">{delivery.business_name}</p>}
        </figure>

        <div className="gift" aria-hidden="true">
          <div className="gift__lid">
            <span className="gift__bow gift__bow--left" />
            <span className="gift__bow gift__bow--right" />
            <span className="gift__knot" />
          </div>
          <div className="gift__base" />
          <div className="gift__glow" />
        </div>

        {children && <div className="scene__card">{children}</div>}
      </div>

      {stage === "wrapped" && (
        <div className="scene__intro">
          <h1 className="scene__title">{delivery.welcome_title || "Something we made for you"}</h1>
          {delivery.welcome_message && <p className="scene__message">{delivery.welcome_message}</p>}
          <div className="scene__actions">
            <button type="button" className="btn btn--ribbon" onClick={onOpen}>
              Open your gift
            </button>
            <button type="button" className="btn-link btn-link--on-wrap" onClick={onSkip}>
              Skip to your project
            </button>
          </div>
        </div>
      )}

      {/* Gift items — shown after the box is opened */}
      {opened && hasGifts && (
        <div className="gift-items" aria-label="Gift items">
          <h2 className="gift-items__title">Inside your gift box</h2>
          <ul className="gift-items__list">
            {giftItems.map((item) => (
              <li key={item.id} className="gift-item">
                <span className="gift-item__icon" aria-hidden="true">{fileIcon(item.mime_type)}</span>
                <div className="gift-item__info">
                  <strong className="gift-item__name">{item.title}</strong>
                  {item.description && <p className="gift-item__desc">{item.description}</p>}
                  <span className="gift-item__meta">{item.file_name} · {formatSize(item.size_bytes)}</span>
                </div>
                {onRequestFile && (
                  <button type="button" className="btn btn--gift-download" onClick={() => onRequestFile(item)}>
                    Download
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
