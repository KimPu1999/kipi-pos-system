export type OrderContact = {
  name: string;
  email: string;
  phone: string;
  location: string;
  zip_code: string;
};
export default function OrderContactFields({
  value,
  onChange,
  disabled = false,
}: {
  value: OrderContact;
  onChange: (value: OrderContact) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="order-contact-fields" disabled={disabled}>
      <legend>Customer details</legend>
      <p>Contact and location details for this pickup order.</p>
      {(
        [
          { key: 'name', label: 'Full name', type: 'text', auto: 'name', max: 100 },
          { key: 'email', label: 'Email address', type: 'email', auto: 'email', max: 254 },
          { key: 'phone', label: 'Phone number', type: 'tel', auto: 'tel', max: 40 },
          {
            key: 'location',
            label: 'Location / address',
            type: 'text',
            auto: 'street-address',
            max: 500,
          },
          {
            key: 'zip_code',
            label: 'ZIP / postal code',
            type: 'text',
            auto: 'postal-code',
            max: 20,
          },
        ] as const
      ).map((f) => (
        <label key={f.key}>
          {f.label}
          <input
            type={f.type}
            autoComplete={f.auto}
            value={value[f.key]}
            maxLength={f.max}
            required
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
          />
        </label>
      ))}
    </fieldset>
  );
}
