type Option<T> = { value: T; label: string; detail?: string };

/** Shared radio markup; each parent retains its fieldset, help and game setting. */
export function DifficultyOptions<T extends string | number>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly Option<T>[];
}) {
  return (
    <div className="difficulty-options">
      {options.map((option) => (
        <label
          key={option.value}
          className={value === option.value ? 'selected' : ''}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>
            <strong>{option.label}</strong>
            {option.detail && <small>{option.detail}</small>}
          </span>
        </label>
      ))}
    </div>
  );
}
