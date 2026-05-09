export default function AdviceFilters({
  filter,
  setFilter,
  category,
  setCategory,
  categories,
  search,
  setSearch,
}: {
  filter: string;
  setFilter: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  categories: string[];
  search: string;
  setSearch: (value: string) => void;
}) {
  const quickFilters = [
    { id: "all", label: "Alle" },
    { id: "ORDER", label: "Bestellen" },
    { id: "NEEDS_REVIEW", label: "Controleren" },
    { id: "REDUCE", label: "Verminderen" },
    { id: "HOLD", label: "Geen actie" },
    { id: "risk", label: "Hoog risico" },
  ];

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-2">
        {quickFilters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              filter === item.id
                ? "border-emerald-dark bg-emerald-dark text-white"
                : "border-border/15 bg-bg text-subtitle hover:bg-card"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Zoek product"
          className="rounded-full border border-border/15 bg-bg px-4 py-2 text-sm text-heading placeholder:text-body/70 focus:outline-none sm:w-56"
        />

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="rounded-full border border-border/15 bg-bg px-4 py-2 text-sm text-heading focus:outline-none"
        >
          <option value="all">Alle categorieën</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
