import React, { useEffect, useId, useState } from "react";
import { api } from "./api";

export default function AddressInput({
  label,
  value,
  onChange,
  name,
  disabled = false,
  required = true,
  placeholder = "Street address or city",
  onChoose,
}) {
  const id = useId(),
    [focused, setFocused] = useState(false),
    [items, setItems] = useState([]),
    [active, setActive] = useState(-1);
  useEffect(() => {
    setItems([]);
    setActive(-1);
    if (!focused) return;
    const abort = new AbortController();
    const timer = setTimeout(
      () =>
        api(`/addresses/suggest?q=${encodeURIComponent(value)}`, {
          signal: abort.signal,
        })
          .then((r) => setItems(r.suggestions))
          .catch(() => {}),
      250,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [value, focused]);
  const visible = focused && items.length > 0;
  const choose = (item) => {
    onChange(item.address);
    onChoose?.(item.address);
    setFocused(false);
    setItems([]);
    setActive(-1);
  };
  return (
    <div className="address-field">
      <label className="field" htmlFor={id}>
        {label}
        <input
          id={id}
          name={name}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={!!visible}
          aria-controls={`${id}-list`}
          aria-activedescendant={
            visible && active >= 0 ? `${id}-${active}` : undefined
          }
          aria-describedby={`${id}-hint`}
          value={value}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            onChange(e.target.value);
            setFocused(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setFocused(false);
              e.stopPropagation();
            }
            if (visible && ["ArrowDown", "ArrowUp"].includes(e.key)) {
              e.preventDefault();
              setActive(
                (i) =>
                  (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
                  items.length,
              );
            }
            if (visible && e.key === "Enter" && active >= 0) {
              e.preventDefault();
              choose(items[active]);
            }
          }}
        />
      </label>
      {visible && (
        <ul
          className="address-suggestions"
          id={`${id}-list`}
          role="listbox"
          aria-label={`${label} suggestions`}
        >
          {items.map((item, i) => (
            <li
              id={`${id}-${i}`}
              key={item.address}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(item)}
            >
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </li>
          ))}
        </ul>
      )}
      <small id={`${id}-hint`} className="muted">
        Demo suggestions · choose the correct city. Street locations are not
        verified.
      </small>
    </div>
  );
}
