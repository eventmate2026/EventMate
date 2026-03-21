export default function Search({
  value = "",
  onChange,
  placeholder = "Search events...",
  name = "search",
}) {
  return (
    <input
      type="search"
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-blue-500"
    />
  );
}
