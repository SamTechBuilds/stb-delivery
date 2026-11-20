import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import type { CardInfo } from "../types";
import { buildVCard, hostOf, safeUrl, whatsappLink } from "../format";

interface Props {
  card: CardInfo;
  compact?: boolean;
}

export function VisitingCard({ card, compact = false }: Props) {
  const vcard = useMemo(() => buildVCard(card), [card]);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(vcard, { errorCorrectionLevel: "M", margin: 1, width: 360, color: { dark: "#1E2A5A", light: "#FFFFFF" } })
      .then((url) => live && setQr(url))
      .catch(() => live && setQr(null));
    return () => { live = false; };
  }, [vcard]);

  const saveContact = () => {
    const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${card.brand_name.replace(/[^\w]+/g, "-")}.vcf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const site = safeUrl(card.website);
  const wa = whatsappLink(card.whatsapp);

  return (
    <article className={`vcard${compact ? " vcard--compact" : ""}`} aria-label={`${card.brand_name} visiting card`}>
      <div className="vcard__face">
        <div className="vcard__main">
          <p className="vcard__brand">{card.brand_name}</p>
          {card.tagline && <p className="vcard__tagline">{card.tagline}</p>}
          {(card.person_name || card.role_title) && (
            <p className="vcard__person">
              {card.person_name}
              {card.person_name && card.role_title && <br />}
              {card.role_title && <span>{card.role_title}</span>}
            </p>
          )}
          <ul className="vcard__lines">
            {card.phone && <li><a href={`tel:${card.phone.replace(/[^\d+]/g, "")}`}>{card.phone}</a></li>}
            {card.email && <li><a href={`mailto:${card.email}`}>{card.email}</a></li>}
            {site && <li><a href={site} target="_blank" rel="noopener noreferrer">{hostOf(site)}</a></li>}
            {card.location && <li>{card.location}</li>}
          </ul>
        </div>
        {qr && (
          <figure className="vcard__qr">
            <img src={qr} alt="QR code that saves this contact to your phone" width={120} height={120} />
            <figcaption>Scan with your phone camera to save this contact</figcaption>
          </figure>
        )}
      </div>
      {!compact && card.services.length > 0 && (
        <p className="vcard__services">{card.services.join(", ")}</p>
      )}
      <div className="vcard__actions">
        <button type="button" className="btn btn--ink" onClick={saveContact}>Save contact</button>
        {wa && <a className="btn btn--ghost" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
        {card.socials.filter((s) => safeUrl(s.url)).slice(0, 4).map((s) => (
          <a key={s.url} className="btn btn--ghost" href={safeUrl(s.url)!} target="_blank" rel="noopener noreferrer">{s.label}</a>
        ))}
      </div>
    </article>
  );
}
