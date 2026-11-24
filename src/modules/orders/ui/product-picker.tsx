"use client";

import { X } from "lucide-react";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { productLabel, productLabelWithSupplier, searchProducts, type CatalogProduct } from "../domain/catalog";

const MAX_OPTIONS = 50;

/** The text a catalog product shows in the field; orders list every supplier, so they name it too. */
export const productText = (product: CatalogProduct, showSupplier: boolean): string =>
  showSupplier ? productLabelWithSupplier(product) : productLabel(product);

/**
 * Catalog product picker: type part of a code or name and choose one of the list. The product is only
 * ever picked, never typed in: while the text is not a chosen product, `onChange` reports null.
 * `initialText` is what the field starts with when the stored product is not in `products`
 * (a legacy product, or one of another supplier).
 */
export function ProductPicker({
  id,
  products,
  value,
  initialText = "",
  showSupplier = false,
  emptyText = "Ningún producto coincide.",
  placeholder = "Buscar por código o nombre",
  onChange,
}: {
  id: string;
  products: readonly CatalogProduct[];
  /** The chosen product's id, or null. */
  value: number | null;
  initialText?: string;
  showSupplier?: boolean;
  /** What the list says when there is nothing to choose from. */
  emptyText?: string;
  placeholder?: string;
  onChange: (productId: number | null, product: CatalogProduct | null) => void;
}) {
  const listId = useId();
  const chosen = products.find((p) => p.id === value) ?? null;
  const [text, setText] = useState(() => (chosen ? productText(chosen, showSupplier) : initialText));
  // False right after choosing: the list then offers the whole catalog again instead of just the chosen one.
  const [typing, setTyping] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const options = useMemo(() => searchProducts(products, typing ? text : "", MAX_OPTIONS), [products, text, typing]);

  function choose(product: CatalogProduct) {
    setText(productText(product, showSupplier));
    setTyping(false);
    setOpen(false);
    onChange(product.id, product);
  }

  function clear() {
    setText("");
    setTyping(false);
    setActive(0);
    onChange(null, null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (options.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if (e.key === "Enter" && open && options[active]) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${listId}-${options[active].id}` : undefined}
        className="h-10 pr-9 md:h-9"
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          setText(e.target.value);
          setTyping(true);
          setActive(0);
          setOpen(true);
          // Typing over a chosen product un-chooses it: only a pick from the list counts.
          if (value !== null) onChange(null, null);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {text !== "" && (
        <button
          type="button"
          onClick={clear}
          aria-label="Quitar producto"
          className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
      <ul
        id={listId}
        role="listbox"
        aria-label="Productos"
        hidden={!open}
        className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-soft"
      >
        {options.length === 0 ? (
          <li className="px-3 py-2 text-sm text-muted-foreground">{products.length === 0 ? emptyText : "Ningún producto coincide."}</li>
        ) : (
          options.map((option, index) => (
            <li
              key={option.id}
              id={`${listId}-${option.id}`}
              role="option"
              aria-selected={option.id === value}
              // mousedown, not click: the input would lose focus and close the list first.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn("cursor-pointer rounded-md px-3 py-2 text-sm", index === active && "bg-muted", option.id === value && "font-medium")}
            >
              <span className="num text-xs text-muted-foreground">{option.code}</span>
              <span className="ml-2">{option.name}</span>
              {showSupplier && <span className="ml-2 text-xs text-muted-foreground">{option.supplier}</span>}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
