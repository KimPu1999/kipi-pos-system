export default function InfoPage({ page }: { page: 'faq' | 'privacy' }) {
  if (page === 'faq')
    return (
      <section className="panel info-page">
        <span className="eyebrow">HELP CENTER</span>
        <h2>Frequently asked questions</h2>
        <details open>
          <summary>How do I place an order?</summary>
          <p>
            Add products to your bag, choose dine-in or takeaway, select payment details, then
            confirm the order.
          </p>
        </details>
        <details>
          <summary>How do I track my order?</summary>
          <p>Open My orders to see Pending, Confirmed, Ready, Completed, or Cancelled status.</p>
        </details>
        <details>
          <summary>When is payment recorded?</summary>
          <p>
            Payment is recorded when store staff completes the order. Wallet transfers are verified
            manually.
          </p>
        </details>
        <details>
          <summary>How do I contact the store?</summary>
          <p>
            Email <a href="mailto:kipipos710@gmail.com">kipipos710@gmail.com</a> or call{' '}
            <a href="tel:09428981899">09428981899</a>.
          </p>
        </details>
      </section>
    );
  return (
    <section className="panel info-page">
      <span className="eyebrow">YOUR INFORMATION</span>
      <h2>Privacy policy</h2>
      <p>
        Kipi POS stores account information, order details, contact information, and payment records
        needed to operate the store and provide receipts.
      </p>
      <h3>Information we use</h3>
      <p>
        We use your name, email, phone, location, order history, and transaction details to process
        orders, provide updates, and maintain business records.
      </p>
      <h3>Payment information</h3>
      <p>
        Wallet transfers are verified manually. Card records store only optional cardholder
        information and the last four digits entered by staff.
      </p>
      <h3>Your choices</h3>
      <p>
        Contact the store to request help with your account information or order records. Business
        records may be retained where required for accounting.
      </p>
      <h3>Contact</h3>
      <p>
        <a href="mailto:kipipos710@gmail.com">kipipos710@gmail.com</a> ·{' '}
        <a href="tel:09428981899">09428981899</a>
      </p>
    </section>
  );
}
