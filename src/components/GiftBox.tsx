import type { DeliveryInfo } from "../types";

interface Props {
  delivery: DeliveryInfo;
  stage: "wrapped" | "opening" | "card";
  onOpen: () => void;
  onSkip: () => void;
  children?: React.ReactNode; // the visiting card, rendered rising out of the box
}

/** The welcome scene: a gift tag addressed to the client, hanging from a ribboned box. */
export function GiftBox({ delivery, stage, onOpen, onSkip, children }: Props) {
  const opened = stage !== "wrapped";
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
    </section>
  );
}
