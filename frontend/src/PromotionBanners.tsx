import CopyCode from './CopyCode';
import { ArrowRight, Tag } from './icons';
import type { Promotion } from './Promotions';
export default function PromotionBanners({
  products = [],
  items,
  onSelect,
}: {
  products?: { id: number; name: string }[];
  items: Promotion[];
  onSelect: (code: string) => void;
}) {
  const active = items.filter(
    (p) => p.active && (!p.expires_on || p.expires_on >= new Date().toISOString().slice(0, 10)),
  );
  if (!active.length) return null;
  return (
    <section className="promotion-section" aria-label="Current promotions">
      <div className="customer-panel-heading">
        <div>
          <span className="customer-kicker">A LITTLE EXTRA, JUST FOR YOU</span>
          <h2>Offers & promotions</h2>
        </div>
        <Tag size={20} />
      </div>
      <div className="promotion-banner-grid">
        {active.map((p) => (
          <article className="promotion-banner" key={p.id}>
            {p.image_path ? (
              <img src={`/api/promotions/${p.id}/image`} alt={p.name} loading="lazy" />
            ) : (
              <div className="promotion-art-fallback">
                <Tag size={38} />
                <b>{p.percent}% OFF</b>
              </div>
            )}
            <div className="promotion-banner-copy">
              <span className="promotion-percent">Save {p.percent}%</span>
              <h3>{p.name}</h3>
              <p className="promotion-product-scope">
                {p.categories.length
                  ? `For categories: ${p.categories.join(', ')}`
                  : 'Applies to all products'}
              </p>
              <p>
                Use code <CopyCode key={p.code} code={p.code} onUse={onSelect} />
                {p.expires_on && <> · Ends {p.expires_on}</>}
              </p>
              <button onClick={() => onSelect(p.code)}>
                Use this offer <ArrowRight size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
