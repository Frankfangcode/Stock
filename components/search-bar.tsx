"use client";

import { FormEvent, useState } from "react";

type SearchBarProps = {
  onSubmit: (symbol: string) => Promise<void> | void;
  pending?: boolean;
};

export function SearchBar({ onSubmit, pending = false }: SearchBarProps) {
  const [value, setValue] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      return;
    }

    await onSubmit(normalized);
    setValue("");
  }

  return (
    <form className="searchBar" onSubmit={handleSubmit}>
      <input
        aria-label="股票代號"
        className="searchInput"
        onChange={(event) => setValue(event.target.value.toUpperCase())}
        placeholder="輸入美股或台股，例如 NVDA、2330"
        value={value}
      />
      <button className="primaryButton" disabled={pending} type="submit">
        {pending ? "分析中..." : "加入分析"}
      </button>
    </form>
  );
}
