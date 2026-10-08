// The partner sees this name on every expense you pay (D-024); the database
// enforces 1–50 characters, mirrored here for a friendlier error.
export function DisplayNameField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label>
      איך לקרוא לך?
      <input
        type="text"
        autoComplete="given-name"
        required
        maxLength={50}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
