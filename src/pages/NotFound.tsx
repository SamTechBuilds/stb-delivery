/**
 * 404 page shown for unrecognised paths. Links to the main STB site.
 */
import { useNavigate } from "react-router";

export function NotFound() {
  const navigate = useNavigate();
  const site = import.meta.env.VITE_STB_WEBSITE as string | undefined;
  const email = import.meta.env.VITE_STB_CONTACT_EMAIL as string | undefined;

  return (
    <div className="wrap wrap--center">
      <div className="notice">
        <h1>Page not found</h1>
        <p>
          This address doesn't match any delivery. If you followed a link, it
          may have been copied incorrectly.
        </p>
        <div className="notice__actions">
          <button
            type="button"
            className="btn btn--ribbon"
            onClick={() => navigate("/")}
          >
            Go home
          </button>
          {email && (
            <a className="btn btn--ghost btn--on-wrap" href={`mailto:${email}`}>
              Contact Sam Tech Builds
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
