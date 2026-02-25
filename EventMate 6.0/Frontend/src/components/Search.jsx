export default function Search({ value = "", onChange, placeholder = "Search events..." }) {
  return (
    <input
      type="search"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-blue-500"
    />
  );
}
